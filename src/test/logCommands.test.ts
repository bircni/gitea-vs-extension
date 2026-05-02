/**
 * Unit tests for log command handlers and argument normalization.
 */
import {
  openLatestFailedJobLogs,
  viewJobLogs,
  type LogCommandsDeps,
} from "../controllers/logCommands";
import type { Job, RepoRef, WorkflowRun } from "../gitea/models";

const mockRepo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };
const mockRun: WorkflowRun = {
  id: 1,
  name: "run",
  status: "completed",
  conclusion: "success",
};
const mockJob: Job = {
  id: 10,
  name: "job",
  status: "completed",
  conclusion: "success",
};

const baseLogDeps: LogCommandsDeps = {
  getJobLogs: vi.fn().mockResolvedValue("log content"),
  getWorkspaceFolderPath: vi.fn().mockReturnValue(undefined),
  getSettings: vi.fn().mockReturnValue({}),
  pathJoin: (...segments: string[]) => segments.join("/"),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  uriFile: vi.fn((p: string) => ({ fsPath: p })),
  openTextDocument: vi.fn().mockResolvedValue({}),
  showTextDocument: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  getEntry: vi.fn().mockReturnValue(undefined),
  loadRunDetails: vi.fn().mockResolvedValue(undefined),
};

describe("viewJobLogs", () => {
  it("shows warning when arg does not normalize to LogArg", async () => {
    const showWarningMessage = vi.fn();
    await viewJobLogs({ ...baseLogDeps, showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("Job not found.");
    expect(baseLogDeps.getJobLogs).not.toHaveBeenCalled();
  });

  it("calls getJobLogs with repo and job.id when payload is valid", async () => {
    const getJobLogs = vi.fn().mockResolvedValue("log content");
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs }, payload);
    expect(getJobLogs).toHaveBeenCalledWith(mockRepo, 10);
  });

  it("saves to file and opens when jobLogsSaveToRepo is true and folder path exists", async () => {
    const getJobLogs = vi.fn().mockResolvedValue("log content");
    const getWorkspaceFolderPath = vi.fn().mockReturnValue("/workspace/repo");
    const getSettings = vi.fn().mockReturnValue({ jobLogsSaveToRepo: true });
    const mkdirSync = vi.fn();
    const writeFileSync = vi.fn();
    const uriFile = vi.fn((p: string) => ({ fsPath: p }));
    const openTextDocument = vi.fn().mockResolvedValue({});
    const showTextDocument = vi.fn().mockResolvedValue(undefined);
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs(
      {
        ...baseLogDeps,
        getJobLogs,
        getWorkspaceFolderPath,
        getSettings,
        mkdirSync,
        writeFileSync,
        uriFile,
        openTextDocument,
        showTextDocument,
      },
      payload,
    );
    expect(getJobLogs).toHaveBeenCalledWith(mockRepo, 10);
    expect(mkdirSync).toHaveBeenCalledWith("/workspace/repo/.tmp/gitea-logs", {
      recursive: true,
    });
    expect(writeFileSync).toHaveBeenCalledWith(
      "/workspace/repo/.tmp/gitea-logs/run-1-job-10.log",
      "log content",
      "utf8",
    );
    expect(openTextDocument).toHaveBeenCalledWith({
      uri: { fsPath: "/workspace/repo/.tmp/gitea-logs/run-1-job-10.log" },
    });
    expect(showTextDocument).toHaveBeenCalledWith({}, { preview: true });
  });

  it("opens in-memory doc when jobLogsSaveToRepo is false", async () => {
    const getJobLogs = vi.fn().mockResolvedValue("log content");
    const openTextDocument = vi.fn().mockResolvedValue({});
    const showTextDocument = vi.fn().mockResolvedValue(undefined);
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, openTextDocument, showTextDocument }, payload);
    expect(openTextDocument).toHaveBeenCalledWith({
      content: "log content",
      language: "log",
    });
    expect(showTextDocument).toHaveBeenCalledWith({}, { preview: true });
  });

  it("shows warning when getJobLogs throws", async () => {
    const getJobLogs = vi.fn().mockRejectedValue(new Error("API error"));
    const showWarningMessage = vi.fn();
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, showWarningMessage }, payload);
    expect(showWarningMessage).toHaveBeenCalledWith("API error");
  });

  it("shows generic message when getJobLogs throws non-Error", async () => {
    const getJobLogs = vi.fn().mockRejectedValue("string");
    const showWarningMessage = vi.fn();
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, showWarningMessage }, payload);
    expect(showWarningMessage).toHaveBeenCalledWith("Failed to load logs.");
  });
});

describe("openLatestFailedJobLogs", () => {
  it("shows warning when arg does not normalize to run payload", async () => {
    const showWarningMessage = vi.fn();
    await openLatestFailedJobLogs({ ...baseLogDeps, showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("Run not found.");
  });

  it("shows info when no failed job in run", async () => {
    const showInformationMessage = vi.fn();
    const getEntry = vi.fn().mockReturnValue({
      jobsByRun: new Map([["1", [mockJob]]]),
    });
    await openLatestFailedJobLogs(
      {
        ...baseLogDeps,
        showInformationMessage,
        getEntry,
        loadRunDetails: vi.fn().mockResolvedValue(undefined),
      },
      { repo: mockRepo, run: mockRun },
    );
    expect(showInformationMessage).toHaveBeenCalledWith("No failed jobs found for this run.");
  });

  it("calls viewJobLogs with failed job when run has one failed job", async () => {
    const failedJob: Job = {
      id: 20,
      name: "failed-job",
      status: "completed",
      conclusion: "failure",
    };
    const getEntry = vi.fn().mockReturnValue({
      jobsByRun: new Map([["1", [mockJob, failedJob]]]),
    });
    const loadRunDetails = vi.fn().mockResolvedValue(undefined);
    const getJobLogs = vi.fn().mockResolvedValue("failed job log");
    const openTextDocument = vi.fn().mockResolvedValue({});
    const showTextDocument = vi.fn().mockResolvedValue(undefined);
    await openLatestFailedJobLogs(
      {
        ...baseLogDeps,
        getEntry,
        loadRunDetails,
        getJobLogs,
        openTextDocument,
        showTextDocument,
      },
      { repo: mockRepo, run: mockRun },
    );
    expect(loadRunDetails).toHaveBeenCalledWith(mockRepo, 1);
    expect(getJobLogs).toHaveBeenCalledWith(mockRepo, 20);
    expect(openTextDocument).toHaveBeenCalledWith({
      content: "failed job log",
      language: "log",
    });
  });
});
