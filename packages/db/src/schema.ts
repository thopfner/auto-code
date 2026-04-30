export const tableNames = [
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

export type TableName = (typeof tableNames)[number];

export interface Migration {
  id: string;
  path: string;
}

export const initialMigration: Migration = {
  id: "0001_initial",
  path: "migrations/0001_initial.sql"
};
