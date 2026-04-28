import type { EntityId, RepoLock } from "./types.js";

export class RepoLockManager {
  private readonly locks = new Map<EntityId, RepoLock>();

  acquire(lock: RepoLock): RepoLock {
    const existing = this.locks.get(lock.repoId);
    if (existing && existing.taskId !== lock.taskId) {
      throw new Error(`Repo ${lock.repoId} is already locked by task ${existing.taskId}`);
    }

    this.locks.set(lock.repoId, lock);
    return lock;
  }

  release(repoId: EntityId, taskId: EntityId): void {
    const existing = this.locks.get(repoId);
    if (!existing) {
      return;
    }

    if (existing.taskId !== taskId) {
      throw new Error(`Task ${taskId} cannot release lock held by ${existing.taskId}`);
    }

    this.locks.delete(repoId);
  }

  current(repoId: EntityId): RepoLock | undefined {
    return this.locks.get(repoId);
  }
}
