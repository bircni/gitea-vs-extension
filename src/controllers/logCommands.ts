/**
 * Log command handlers: view job logs, open latest failed job logs.
 * Extracted from commands.ts for testability and single responsibility.
 */
import type { Job, RepoRef } from "../gitea/models";
import { normalizeLogArg, normalizeRunArg, type LogArg } from "../util/commandArgs";

export type LogCommandsDeps = {
  getJobLogs: (repo: RepoRef, jobId: number | string) => Promise<string>;
  getWorkspaceFolderPath: (repo: RepoRef) => string | undefined;
  getSettings: () => { jobLogsSaveToRepo?: boolean };
  pathJoin: (...segments: string[]) => string;
  mkdirSync: (dir: string, opts: { recursive: boolean }) => void;
  writeFileSync: (path: string, content: string, encoding?: string) => void;
  uriFile: (path: string) => unknown;
  openTextDocument: (
    options: { content: string; language: string } | { uri: unknown },
  ) => PromiseLike<unknown>;
  showTextDocument: (doc: unknown, options: { preview: boolean }) => PromiseLike<unknown>;
  showWarningMessage: (msg: string) => void;
  showInformationMessage: (msg: string) => void;
  getEntry: (repo: RepoRef) => { jobsByRun: Map<string, Job[]> } | undefined;
  loadRunDetails: (repo: RepoRef, runId: number | string) => Promise<void>;
};

export async function viewJobLogs(deps: LogCommandsDeps, arg: unknown): Promise<void> {
  const payload = normalizeLogArg(arg);
  if (!payload) {
    deps.showWarningMessage("Job not found.");
    return;
  }

  try {
    const content = await deps.getJobLogs(payload.repo, payload.job.id);
    const settings = deps.getSettings();

    if (settings.jobLogsSaveToRepo) {
      const folderPath = deps.getWorkspaceFolderPath(payload.repo);
      if (folderPath) {
        const safe = (id: number | string) => String(id).replaceAll(/[^a-zA-Z0-9.-]/g, "-");
        const fileName = `run-${safe(payload.run.id)}-job-${safe(payload.job.id)}.log`;
        const logDir = deps.pathJoin(folderPath, ".tmp", "gitea-logs");
        const filePath = deps.pathJoin(logDir, fileName);
        deps.mkdirSync(logDir, { recursive: true });
        deps.writeFileSync(filePath, content, "utf8");
        const uri = deps.uriFile(filePath);
        const doc = await deps.openTextDocument({ uri });
        await deps.showTextDocument(doc, { preview: true });
        return;
      }
    }

    const doc = await deps.openTextDocument({ content, language: "log" });
    await deps.showTextDocument(doc, { preview: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load logs.";
    deps.showWarningMessage(message);
  }
}

export async function openLatestFailedJobLogs(deps: LogCommandsDeps, arg: unknown): Promise<void> {
  const runPayload = normalizeRunArg(arg);
  if (!runPayload) {
    deps.showWarningMessage("Run not found.");
    return;
  }

  await deps.loadRunDetails(runPayload.repo, runPayload.run.id);
  const entry = deps.getEntry(runPayload.repo);
  const jobs = entry?.jobsByRun.get(String(runPayload.run.id)) ?? [];
  const failedJob = jobs.find((job) => job.conclusion === "failure");
  if (!failedJob) {
    deps.showInformationMessage("No failed jobs found for this run.");
    return;
  }

  const payload: LogArg = {
    repo: runPayload.repo,
    run: runPayload.run,
    job: failedJob,
  };
  await viewJobLogs(deps, payload);
}
