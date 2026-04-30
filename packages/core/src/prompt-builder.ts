import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ForgeTask, RepoRegistration, RunnerRole } from "./types.js";

export interface PromptBuildRequest {
  task: ForgeTask;
  repo: RepoRegistration;
  role: RunnerRole;
  briefPath: string;
  artifactDir: string;
  resumeText?: string;
}

export interface PromptBuildResult {
  promptPath: string;
  prompt: string;
}

export class ForgePromptBuilder {
  constructor(private readonly promptRoot = ".auto-forge/prompts") {}

  async build(request: PromptBuildRequest): Promise<PromptBuildResult> {
    const prompt = this.render(request);
    const promptDir = join(this.promptRoot, request.task.id);
    await mkdir(promptDir, { recursive: true });
    const promptPath = join(promptDir, `${request.role}.md`);
    await writeFile(promptPath, prompt, { mode: 0o600 });
    return { promptPath, prompt };
  }

  render(request: PromptBuildRequest): string {
    const resume = request.resumeText ? `\nHuman response:\n${request.resumeText}\n` : "";
    return [
      `You are running the ${request.role} role for Auto Forge Controller task ${request.task.id}.`,
      "",
      "Task:",
      `- Title: ${request.task.title}`,
      `- Repo: ${request.repo.name}`,
      `- Repo path: ${request.repo.repoPath}`,
      `- Default branch: ${request.repo.defaultBranch}`,
      `- Active brief path: ${request.briefPath}`,
      `- Artifact directory: ${request.artifactDir}`,
      resume,
      "Contract:",
      "- Follow the active brief and repo memory.",
      "- Keep changes scoped to the authorized window.",
      "- Write Forge stop artifacts under the active brief reports/ and automation/ paths.",
      "- For every checkpoint, write these canonical files: reports/LATEST.md, reports/LATEST.json, automation/state.json, and automation/qa.json.",
      "- automation/qa.json must include top-level task_id, qa_status, implementation_commit_sha, stop_report_commit_sha, push_status, human_input_required, and updated_at.",
      "- Use qa_status CLEAR_CURRENT_PHASE only when local product QA passed. Encode push/auth/publishing failures in push_status and human_input_required instead of changing local QA into a product failure.",
      "- Use qa_status REVISION_PACK_REQUIRED for product defects, REPLAN_REQUIRED for plan/design changes, and BLOCKED_EXTERNAL only when local QA cannot run or an external dependency prevents judgment.",
      "- Include full 40-character commit SHAs and push status whenever a phase checkpoint is reached.",
      "- If human input is needed, stop with a clear question or approval request instead of guessing."
    ]
      .filter(Boolean)
      .join("\n");
  }
}
