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
  getJobLogs: jest.fn().mockResolvedValue("log content"),
  getWorkspaceFolderPath: jest.fn().mockReturnValue(undefined),
  getSettings: jest.fn().mockReturnValue({}),
  pathJoin: (...segments: string[]) => segments.join("/"),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  uriFile: jest.fn((p: string) => ({ fsPath: p })),
  openTextDocument: jest.fn().mockResolvedValue({}),
  showTextDocument: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  getEntry: jest.fn().mockReturnValue(undefined),
  loadRunDetails: jest.fn().mockResolvedValue(undefined),
};

describe("viewJobLogs", () => {
  it("shows warning when arg does not normalize to LogArg", async () => {
    const showWarningMessage = jest.fn();
    await viewJobLogs({ ...baseLogDeps, showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("Job not found.");
    expect(baseLogDeps.getJobLogs).not.toHaveBeenCalled();
  });

  it("calls getJobLogs with repo and job.id when payload is valid", async () => {
    const getJobLogs = jest.fn().mockResolvedValue("log content");
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs }, payload);
    expect(getJobLogs).toHaveBeenCalledWith(mockRepo, 10);
  });

  it("saves to file and opens when jobLogsSaveToRepo is true and folder path exists", async () => {
    const getJobLogs = jest.fn().mockResolvedValue("log content");
    const getWorkspaceFolderPath = jest.fn().mockReturnValue("/workspace/repo");
    const getSettings = jest.fn().mockReturnValue({ jobLogsSaveToRepo: true });
    const mkdirSync = jest.fn();
    const writeFileSync = jest.fn();
    const uriFile = jest.fn((p: string) => ({ fsPath: p }));
    const openTextDocument = jest.fn().mockResolvedValue({});
    const showTextDocument = jest.fn().mockResolvedValue(undefined);
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
    const getJobLogs = jest.fn().mockResolvedValue("log content");
    const openTextDocument = jest.fn().mockResolvedValue({});
    const showTextDocument = jest.fn().mockResolvedValue(undefined);
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, openTextDocument, showTextDocument }, payload);
    expect(openTextDocument).toHaveBeenCalledWith({
      content: "log content",
      language: "log",
    });
    expect(showTextDocument).toHaveBeenCalledWith({}, { preview: true });
  });

  it("shows warning when getJobLogs throws", async () => {
    const getJobLogs = jest.fn().mockRejectedValue(new Error("API error"));
    const showWarningMessage = jest.fn();
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, showWarningMessage }, payload);
    expect(showWarningMessage).toHaveBeenCalledWith("API error");
  });

  it("shows generic message when getJobLogs throws non-Error", async () => {
    const getJobLogs = jest.fn().mockRejectedValue("string");
    const showWarningMessage = jest.fn();
    const payload = { repo: mockRepo, run: mockRun, job: mockJob };
    await viewJobLogs({ ...baseLogDeps, getJobLogs, showWarningMessage }, payload);
    expect(showWarningMessage).toHaveBeenCalledWith("Failed to load logs.");
  });
});

describe("openLatestFailedJobLogs", () => {
  it("shows warning when arg does not normalize to run payload", async () => {
    const showWarningMessage = jest.fn();
    await openLatestFailedJobLogs({ ...baseLogDeps, showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("Run not found.");
  });

  it("shows info when no failed job in run", async () => {
    const showInformationMessage = jest.fn();
    const getEntry = jest.fn().mockReturnValue({
      jobsByRun: new Map([["1", [mockJob]]]),
    });
    await openLatestFailedJobLogs(
      {
        ...baseLogDeps,
        showInformationMessage,
        getEntry,
        loadRunDetails: jest.fn().mockResolvedValue(undefined),
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
    const getEntry = jest.fn().mockReturnValue({
      jobsByRun: new Map([["1", [mockJob, failedJob]]]),
    });
    const loadRunDetails = jest.fn().mockResolvedValue(undefined);
    const getJobLogs = jest.fn().mockResolvedValue("failed job log");
    const openTextDocument = jest.fn().mockResolvedValue({});
    const showTextDocument = jest.fn().mockResolvedValue(undefined);
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
