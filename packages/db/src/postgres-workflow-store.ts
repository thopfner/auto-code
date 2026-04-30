import pg from "pg";
import type {
  Approval,
  ArtifactRecord,
  EntityId,
  ForgeTask,
  RepoRegistryEvent,
  RepoRegistration,
  RunAttempt,
  RunnerProfile,
  User
} from "../../core/src/index.js";
import type { WorkflowEvent, WorkflowStore, WorkflowStoreReadiness } from "../../core/src/workflow-store.js";

const { Pool } = pg;

export interface PostgresWorkflowStoreOptions {
  connectionString: string;
}

export class PostgresWorkflowStore implements WorkflowStore {
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | undefined;
  private readonly connectionFingerprint: string;

  constructor(options: PostgresWorkflowStoreOptions) {
    this.pool = new Pool({ connectionString: options.connectionString });
    this.connectionFingerprint = fingerprintConnectionString(options.connectionString);
  }

  async checkReadiness(): Promise<WorkflowStoreReadiness> {
    try {
      await this.ensureSchema();
      const result = await this.pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])
         ORDER BY table_name ASC`,
        [workflowTableNames]
      );
      const presentTables = new Set(result.rows.map((row) => row.table_name));
      const missingTables = workflowTableNames.filter((table) => !presentTables.has(table));
      if (missingTables.length > 0) {
        return {
          mode: "postgres",
          ready: false,
          message: `Postgres workflow store is missing tables: ${missingTables.join(", ")}`,
          details: {
            connectionFingerprint: this.connectionFingerprint,
            missingTables
          }
        };
      }
      return {
        mode: "postgres",
        ready: true,
        message: "Postgres workflow store is reachable and schema is ready",
        details: {
          connectionFingerprint: this.connectionFingerprint,
          checkedTables: workflowTableNames
        }
      };
    } catch (error) {
      return {
        mode: "postgres",
        ready: false,
        message: error instanceof Error ? error.message : "Postgres workflow store readiness check failed",
        details: {
          connectionFingerprint: this.connectionFingerprint
        }
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async saveUser(user: User): Promise<void> {
    await this.query(
      `INSERT INTO users (id, telegram_user_id, display_name, role, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
       SET telegram_user_id = EXCLUDED.telegram_user_id,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role`,
      [user.id, user.telegramUserId, user.displayName, user.role, user.createdAt]
    );
  }

  async getUser(id: EntityId): Promise<User | undefined> {
    const result = await this.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ? userFromRow(result.rows[0]) : undefined;
  }

  async saveRepo(repo: RepoRegistration): Promise<void> {
    await this.query(
      `INSERT INTO repos (id, name, repo_path, default_branch, ssh_remote, is_paused, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           repo_path = EXCLUDED.repo_path,
           default_branch = EXCLUDED.default_branch,
           ssh_remote = EXCLUDED.ssh_remote,
           is_paused = EXCLUDED.is_paused`,
      [repo.id, repo.name, repo.repoPath, repo.defaultBranch, repo.sshRemote ?? null, repo.isPaused, repo.createdAt]
    );
  }

  async getRepo(id: EntityId): Promise<RepoRegistration | undefined> {
    const result = await this.query<RepoRow>("SELECT * FROM repos WHERE id = $1", [id]);
    return result.rows[0] ? repoFromRow(result.rows[0]) : undefined;
  }

  async listRepos(): Promise<RepoRegistration[]> {
    const result = await this.query<RepoRow>("SELECT * FROM repos ORDER BY name ASC");
    return result.rows.map(repoFromRow);
  }

  async findRepoByName(name: string): Promise<RepoRegistration | undefined> {
    const result = await this.query<RepoRow>("SELECT * FROM repos WHERE name = $1 LIMIT 1", [name]);
    return result.rows[0] ? repoFromRow(result.rows[0]) : undefined;
  }

  async getActiveRepoId(userId: EntityId): Promise<EntityId | undefined> {
    const result = await this.query<{ repo_id: string }>("SELECT repo_id FROM active_repo_selections WHERE user_id = $1", [userId]);
    return result.rows[0]?.repo_id;
  }

  async setActiveRepoId(userId: EntityId, repoId: EntityId): Promise<void> {
    await this.query(
      `INSERT INTO active_repo_selections (user_id, repo_id, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE
       SET repo_id = EXCLUDED.repo_id,
           updated_at = now()`,
      [userId, repoId]
    );
  }

  async appendRepoEvent(event: RepoRegistryEvent): Promise<void> {
    await this.query(
      `INSERT INTO repo_events (id, repo_id, alias, user_id, action, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [event.id, event.repoId ?? null, event.alias, event.userId, event.action, JSON.stringify(event.payload), event.createdAt]
    );
  }

  async listRepoEvents(repoId?: EntityId): Promise<RepoRegistryEvent[]> {
    const result = repoId
      ? await this.query<RepoEventRow>("SELECT * FROM repo_events WHERE repo_id = $1 ORDER BY created_at ASC", [repoId])
      : await this.query<RepoEventRow>("SELECT * FROM repo_events ORDER BY created_at ASC");
    return result.rows.map(repoEventFromRow);
  }

  async saveRunnerProfile(profile: RunnerProfile): Promise<void> {
    await this.query(
      `INSERT INTO runner_profiles (id, name, role, codex_auth_ref, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           role = EXCLUDED.role,
           codex_auth_ref = EXCLUDED.codex_auth_ref,
           model = EXCLUDED.model`,
      [profile.id, profile.name, profile.role, profile.codexAuthRef, profile.model ?? null, profile.createdAt]
    );
  }

  async getRunnerProfile(role: RunnerProfile["role"]): Promise<RunnerProfile | undefined> {
    const result = await this.query<RunnerProfileRow>("SELECT * FROM runner_profiles WHERE role = $1 ORDER BY created_at ASC LIMIT 1", [role]);
    return result.rows[0] ? runnerProfileFromRow(result.rows[0]) : undefined;
  }

  async saveTask(task: ForgeTask): Promise<void> {
    await this.query(
      `INSERT INTO tasks (id, repo_id, requested_by_user_id, title, kind, status, current_run_id, pending_approval_id, blocked_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE
       SET repo_id = EXCLUDED.repo_id,
           requested_by_user_id = EXCLUDED.requested_by_user_id,
           title = EXCLUDED.title,
           kind = EXCLUDED.kind,
           status = EXCLUDED.status,
           current_run_id = EXCLUDED.current_run_id,
           pending_approval_id = EXCLUDED.pending_approval_id,
           blocked_reason = EXCLUDED.blocked_reason,
           updated_at = EXCLUDED.updated_at`,
      [
        task.id,
        task.repoId,
        task.requestedByUserId,
        task.title,
        task.kind,
        task.status,
        task.currentRunId ?? null,
        task.pendingApprovalId ?? null,
        task.blockedReason ?? null,
        task.createdAt,
        task.updatedAt
      ]
    );
  }

  async getTask(id: EntityId): Promise<ForgeTask | undefined> {
    const result = await this.query<TaskRow>("SELECT * FROM tasks WHERE id = $1", [id]);
    return result.rows[0] ? taskFromRow(result.rows[0]) : undefined;
  }

  async listTasks(): Promise<ForgeTask[]> {
    const result = await this.query<TaskRow>("SELECT * FROM tasks ORDER BY created_at ASC");
    return result.rows.map(taskFromRow);
  }

  async saveApproval(approval: Approval): Promise<void> {
    await this.query(
      `INSERT INTO approvals (id, task_id, requested_by_run_id, decision_text, kind, status, decided_by_user_id, decided_at, response_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE
       SET task_id = EXCLUDED.task_id,
           requested_by_run_id = EXCLUDED.requested_by_run_id,
           decision_text = EXCLUDED.decision_text,
           kind = EXCLUDED.kind,
           status = EXCLUDED.status,
           decided_by_user_id = EXCLUDED.decided_by_user_id,
           decided_at = EXCLUDED.decided_at,
           response_text = EXCLUDED.response_text`,
      [
        approval.id,
        approval.taskId,
        approval.requestedByRunId,
        approval.decisionText,
        approval.kind,
        approval.status,
        approval.decidedByUserId ?? null,
        approval.decidedAt ?? null,
        approval.responseText ?? null
      ]
    );
  }

  async getApproval(id: EntityId): Promise<Approval | undefined> {
    const result = await this.query<ApprovalRow>("SELECT * FROM approvals WHERE id = $1", [id]);
    return result.rows[0] ? approvalFromRow(result.rows[0]) : undefined;
  }

  async findPendingApproval(taskId: EntityId): Promise<Approval | undefined> {
    const result = await this.query<ApprovalRow>("SELECT * FROM approvals WHERE task_id = $1 AND status = 'pending' LIMIT 1", [taskId]);
    return result.rows[0] ? approvalFromRow(result.rows[0]) : undefined;
  }

  async saveRunAttempt(run: RunAttempt): Promise<void> {
    await this.query(
      `INSERT INTO run_attempts (id, task_id, role, status, started_at, finished_at, log_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
       SET task_id = EXCLUDED.task_id,
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           started_at = EXCLUDED.started_at,
           finished_at = EXCLUDED.finished_at,
           log_path = EXCLUDED.log_path`,
      [run.id, run.taskId, run.role, run.status, run.startedAt ?? null, run.finishedAt ?? null, run.logPath ?? null]
    );
  }

  async listRunAttempts(taskId: EntityId): Promise<RunAttempt[]> {
    const result = await this.query<RunAttemptRow>("SELECT * FROM run_attempts WHERE task_id = $1 ORDER BY started_at ASC NULLS LAST, id ASC", [
      taskId
    ]);
    return result.rows.map(runAttemptFromRow);
  }

  async saveArtifact(artifact: ArtifactRecord): Promise<void> {
    await this.query(
      `INSERT INTO artifacts (id, task_id, path, kind, sha256, observed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET task_id = EXCLUDED.task_id,
           path = EXCLUDED.path,
           kind = EXCLUDED.kind,
           sha256 = EXCLUDED.sha256,
           observed_at = EXCLUDED.observed_at`,
      [artifact.id, artifact.taskId, artifact.path, artifact.kind, artifact.sha256 ?? null, artifact.observedAt]
    );
  }

  async listArtifacts(taskId: EntityId): Promise<ArtifactRecord[]> {
    const result = await this.query<ArtifactRow>("SELECT * FROM artifacts WHERE task_id = $1 ORDER BY observed_at ASC, id ASC", [taskId]);
    return result.rows.map(artifactFromRow);
  }

  async appendEvent(event: WorkflowEvent): Promise<void> {
    await this.query(
      "INSERT INTO task_events (task_id, event_type, payload, created_at) VALUES ($1, $2, $3, $4)",
      [event.taskId, event.eventType, JSON.stringify(event.payload), event.createdAt]
    );
  }

  async listEvents(taskId: EntityId): Promise<WorkflowEvent[]> {
    const result = await this.query<TaskEventRow>("SELECT * FROM task_events WHERE task_id = $1 ORDER BY created_at ASC, id ASC", [taskId]);
    return result.rows.map(taskEventFromRow);
  }

  private async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<pg.QueryResult<T>> {
    await this.ensureSchema();
    return this.pool.query<T>(text, values);
  }

  ensureSchema(): Promise<void> {
    this.schemaReady ??= this.createSchema();
    return this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    await this.pool.query(schemaSql);
  }
}

export function fingerprintConnectionString(connectionString: string): string {
  let hash = 0x811c9dc5;
  for (const char of connectionString) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const workflowTableNames = [
  "users",
  "repos",
  "runner_profiles",
  "active_repo_selections",
  "repo_events",
  "tasks",
  "approvals",
  "run_attempts",
  "artifacts",
  "repo_locks",
  "task_events"
] as const;

interface UserRow {
  id: string;
  telegram_user_id: string;
  display_name: string;
  role: User["role"];
  created_at: Date;
}

interface RepoRow {
  id: string;
  name: string;
  repo_path: string;
  default_branch: string;
  ssh_remote: string | null;
  is_paused: boolean;
  created_at: Date;
}

interface RunnerProfileRow {
  id: string;
  name: string;
  role: RunnerProfile["role"];
  codex_auth_ref: RunnerProfile["codexAuthRef"];
  model: string | null;
  created_at: Date;
}

interface TaskRow {
  id: string;
  repo_id: string;
  requested_by_user_id: string;
  title: string;
  kind: ForgeTask["kind"];
  status: ForgeTask["status"];
  current_run_id: string | null;
  pending_approval_id: string | null;
  blocked_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ApprovalRow {
  id: string;
  task_id: string;
  requested_by_run_id: string;
  decision_text: string;
  kind: Approval["kind"];
  status: Approval["status"];
  decided_by_user_id: string | null;
  decided_at: Date | null;
  response_text: string | null;
}

interface RunAttemptRow {
  id: string;
  task_id: string;
  role: RunAttempt["role"];
  status: RunAttempt["status"];
  started_at: Date | null;
  finished_at: Date | null;
  log_path: string | null;
}

interface ArtifactRow {
  id: string;
  task_id: string;
  path: string;
  kind: ArtifactRecord["kind"];
  sha256: string | null;
  observed_at: Date;
}

interface RepoEventRow {
  id: string;
  repo_id: string | null;
  alias: string;
  user_id: string;
  action: RepoRegistryEvent["action"];
  payload: Record<string, unknown>;
  created_at: Date;
}

interface TaskEventRow {
  task_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at
  };
}

function repoFromRow(row: RepoRow): RepoRegistration {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    defaultBranch: row.default_branch,
    sshRemote: row.ssh_remote ?? undefined,
    isPaused: row.is_paused,
    createdAt: row.created_at
  };
}

function runnerProfileFromRow(row: RunnerProfileRow): RunnerProfile {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    codexAuthRef: row.codex_auth_ref,
    model: row.model ?? undefined,
    createdAt: row.created_at
  };
}

function taskFromRow(row: TaskRow): ForgeTask {
  return {
    id: row.id,
    repoId: row.repo_id,
    requestedByUserId: row.requested_by_user_id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    currentRunId: row.current_run_id ?? undefined,
    pendingApprovalId: row.pending_approval_id ?? undefined,
    blockedReason: row.blocked_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function approvalFromRow(row: ApprovalRow): Approval {
  return {
    id: row.id,
    taskId: row.task_id,
    requestedByRunId: row.requested_by_run_id,
    decisionText: row.decision_text,
    kind: row.kind,
    status: row.status,
    decidedByUserId: row.decided_by_user_id ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    responseText: row.response_text ?? undefined
  };
}

function runAttemptFromRow(row: RunAttemptRow): RunAttempt {
  return {
    id: row.id,
    taskId: row.task_id,
    role: row.role,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    logPath: row.log_path ?? undefined
  };
}

function artifactFromRow(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    path: row.path,
    kind: row.kind,
    sha256: row.sha256 ?? undefined,
    observedAt: row.observed_at
  };
}

function repoEventFromRow(row: RepoEventRow): RepoRegistryEvent {
  return {
    id: row.id,
    repoId: row.repo_id ?? undefined,
    alias: row.alias,
    userId: row.user_id,
    action: row.action,
    payload: row.payload,
    createdAt: row.created_at
  };
}

function taskEventFromRow(row: TaskEventRow): WorkflowEvent {
  return {
    taskId: row.task_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at
  };
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL,
  ssh_remote TEXT,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runner_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('scope', 'planner', 'worker', 'qa')),
  codex_auth_ref TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_repo_selections (
  user_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repo_events (
  id TEXT PRIMARY KEY,
  repo_id TEXT REFERENCES repos(id),
  alias TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  current_run_id TEXT,
  pending_approval_id TEXT,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  requested_by_run_id TEXT NOT NULL,
  decision_text TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('clarification', 'planning', 'qa')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_user_id TEXT REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  response_text TEXT
);

CREATE TABLE IF NOT EXISTS run_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  role TEXT NOT NULL CHECK (role IN ('scope', 'planner', 'worker', 'qa')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  log_path TEXT
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  sha256 TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repo_locks (
  repo_id TEXT PRIMARY KEY REFERENCES repos(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_repo_status_idx ON tasks(repo_id, status);
CREATE INDEX IF NOT EXISTS repo_events_repo_idx ON repo_events(repo_id);
CREATE INDEX IF NOT EXISTS run_attempts_task_role_idx ON run_attempts(task_id, role);
CREATE INDEX IF NOT EXISTS artifacts_task_kind_idx ON artifacts(task_id, kind);
`;
