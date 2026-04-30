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
} from "./types.js";

export interface WorkflowEvent {
  taskId: EntityId;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export type WorkflowStoreMode = "memory" | "postgres";

export interface WorkflowStoreReadiness {
  mode: WorkflowStoreMode;
  ready: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface WorkflowStore {
  checkReadiness(): Promise<WorkflowStoreReadiness>;
  saveUser(user: User): Promise<void>;
  getUser(id: EntityId): Promise<User | undefined>;
  saveRepo(repo: RepoRegistration): Promise<void>;
  getRepo(id: EntityId): Promise<RepoRegistration | undefined>;
  listRepos(): Promise<RepoRegistration[]>;
  findRepoByName(name: string): Promise<RepoRegistration | undefined>;
  getActiveRepoId(userId: EntityId): Promise<EntityId | undefined>;
  setActiveRepoId(userId: EntityId, repoId: EntityId): Promise<void>;
  appendRepoEvent(event: RepoRegistryEvent): Promise<void>;
  listRepoEvents(repoId?: EntityId): Promise<RepoRegistryEvent[]>;
  saveRunnerProfile(profile: RunnerProfile): Promise<void>;
  getRunnerProfile(role: RunnerProfile["role"]): Promise<RunnerProfile | undefined>;
  saveTask(task: ForgeTask): Promise<void>;
  getTask(id: EntityId): Promise<ForgeTask | undefined>;
  listTasks(): Promise<ForgeTask[]>;
  saveApproval(approval: Approval): Promise<void>;
  getApproval(id: EntityId): Promise<Approval | undefined>;
  findPendingApproval(taskId: EntityId): Promise<Approval | undefined>;
  saveRunAttempt(run: RunAttempt): Promise<void>;
  listRunAttempts(taskId: EntityId): Promise<RunAttempt[]>;
  saveArtifact(artifact: ArtifactRecord): Promise<void>;
  listArtifacts(taskId: EntityId): Promise<ArtifactRecord[]>;
  appendEvent(event: WorkflowEvent): Promise<void>;
  listEvents(taskId: EntityId): Promise<WorkflowEvent[]>;
}

export class MemoryWorkflowStore implements WorkflowStore {
  readonly users = new Map<EntityId, User>();
  readonly repos = new Map<EntityId, RepoRegistration>();
  readonly activeRepoIds = new Map<EntityId, EntityId>();
  readonly repoEvents: RepoRegistryEvent[] = [];
  readonly profiles = new Map<RunnerProfile["role"], RunnerProfile>();
  readonly tasks = new Map<EntityId, ForgeTask>();
  readonly approvals = new Map<EntityId, Approval>();
  readonly runs = new Map<EntityId, RunAttempt>();
  readonly artifacts = new Map<EntityId, ArtifactRecord>();
  readonly events: WorkflowEvent[] = [];

  async checkReadiness(): Promise<WorkflowStoreReadiness> {
    return {
      mode: "memory",
      ready: true,
      message: "In-memory workflow store is active; state will not survive process restart"
    };
  }

  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async getUser(id: EntityId): Promise<User | undefined> {
    return this.users.get(id);
  }

  async saveRepo(repo: RepoRegistration): Promise<void> {
    this.repos.set(repo.id, repo);
  }

  async getRepo(id: EntityId): Promise<RepoRegistration | undefined> {
    return this.repos.get(id);
  }

  async listRepos(): Promise<RepoRegistration[]> {
    return [...this.repos.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async findRepoByName(name: string): Promise<RepoRegistration | undefined> {
    return [...this.repos.values()].find((repo) => repo.name === name);
  }

  async getActiveRepoId(userId: EntityId): Promise<EntityId | undefined> {
    return this.activeRepoIds.get(userId);
  }

  async setActiveRepoId(userId: EntityId, repoId: EntityId): Promise<void> {
    this.activeRepoIds.set(userId, repoId);
  }

  async appendRepoEvent(event: RepoRegistryEvent): Promise<void> {
    this.repoEvents.push(event);
  }

  async listRepoEvents(repoId?: EntityId): Promise<RepoRegistryEvent[]> {
    return repoId ? this.repoEvents.filter((event) => event.repoId === repoId) : [...this.repoEvents];
  }

  async saveRunnerProfile(profile: RunnerProfile): Promise<void> {
    this.profiles.set(profile.role, profile);
  }

  async getRunnerProfile(role: RunnerProfile["role"]): Promise<RunnerProfile | undefined> {
    return this.profiles.get(role);
  }

  async saveTask(task: ForgeTask): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async getTask(id: EntityId): Promise<ForgeTask | undefined> {
    return this.tasks.get(id);
  }

  async listTasks(): Promise<ForgeTask[]> {
    return [...this.tasks.values()];
  }

  async saveApproval(approval: Approval): Promise<void> {
    this.approvals.set(approval.id, approval);
  }

  async getApproval(id: EntityId): Promise<Approval | undefined> {
    return this.approvals.get(id);
  }

  async findPendingApproval(taskId: EntityId): Promise<Approval | undefined> {
    return [...this.approvals.values()].find((approval) => approval.taskId === taskId && approval.status === "pending");
  }

  async saveRunAttempt(run: RunAttempt): Promise<void> {
    this.runs.set(run.id, run);
  }

  async listRunAttempts(taskId: EntityId): Promise<RunAttempt[]> {
    return [...this.runs.values()].filter((run) => run.taskId === taskId);
  }

  async saveArtifact(artifact: ArtifactRecord): Promise<void> {
    this.artifacts.set(artifact.id, artifact);
  }

  async listArtifacts(taskId: EntityId): Promise<ArtifactRecord[]> {
    return [...this.artifacts.values()].filter((artifact) => artifact.taskId === taskId);
  }

  async appendEvent(event: WorkflowEvent): Promise<void> {
    this.events.push(event);
  }

  async listEvents(taskId: EntityId): Promise<WorkflowEvent[]> {
    return this.events.filter((event) => event.taskId === taskId);
  }
}
