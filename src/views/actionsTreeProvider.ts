import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import { getToken } from "../config/secrets";
import type { RepoStateStore } from "../util/cache";
import { expandedRepoKey, expandedRunKey, expandedWorkflowKey } from "../util/expandedState";
import type { GiteaCapabilities } from "../gitea/api";
import {
  ArtifactNode,
  ErrorNode,
  JobNode,
  MessageNode,
  PullRequestNode,
  RepoNode,
  RunNode,
  SectionNode,
  StepNode,
  WorkflowGroupNode,
  type TreeNode,
} from "./nodes";
import type { Job, RepoRef, WorkflowRun } from "../gitea/models";

export type ProviderMode = "runs" | "workflows" | "pullRequests";

export class ActionsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly mode: ProviderMode,
    private readonly store: RepoStateStore,
    private readonly secrets: vscode.SecretStorage,
    private readonly expanded: Set<string>,
    private readonly capabilitiesProvider: () => Promise<GiteaCapabilities> = () =>
      Promise.resolve({
        runs: true,
        runDetails: true,
        runDelete: true,
        jobs: true,
        jobDetails: true,
        jobLogs: true,
        runArtifacts: true,
        repoArtifacts: true,
        artifactDetails: true,
        artifactDownload: true,
        workflows: true,
        workflowDetails: true,
        workflowEnable: true,
        workflowDisable: true,
        workflowDispatch: true,
        pullRequests: true,
        pullRequestDetails: true,
        pullRequestCommits: true,
        pullRequestFiles: true,
        pullRequestMerge: true,
        pullRequestUpdate: true,
        requestedReviewers: true,
        pullRequestReviews: true,
        pullRequestReviewComments: true,
        reposListing: true,
        version: true,
      }),
  ) {}

  refresh(node?: TreeNode): void {
    this._onDidChangeTreeData.fire(node);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      return this.getRootNodes();
    }

    if (element instanceof RepoNode) {
      return this.getRepoChildren(element.repo);
    }

    if (element instanceof WorkflowGroupNode) {
      return element.runs.map(
        (entry) =>
          new RunNode(
            entry.repo,
            entry.run,
            this.isExpanded(expandedRunKey(entry.repo, entry.run.id)),
          ),
      );
    }

    if (element instanceof RunNode) {
      return this.getRunChildren(element.repo, element.run);
    }

    if (element instanceof JobNode) {
      return this.getJobChildren(element.repo, element.run, element.job);
    }

    if (element instanceof SectionNode) {
      if (element.sectionType === "pullRequests") {
        return this.getPullRequestChildren(element.repo);
      }
      if (element.sectionType === "errors") {
        return this.getErrorChildren(element.repo);
      }
      if (element.runId !== undefined) {
        return this.getArtifactChildren(element.repo, element.runId);
      }
    }

    return [];
  }

  private async getRootNodes(): Promise<TreeNode[]> {
    const settings = getSettings();
    if (!settings.baseUrl) {
      return [
        new MessageNode(
          "Set gitea-vs-extension.baseUrl to get started.",
          "info",
          "configureBaseUrl",
        ),
      ];
    }

    const token = await getToken(this.secrets);
    if (!token) {
      return [new MessageNode("Set a token to access Gitea.", "info", "setToken")];
    }

    const capabilities = await this.capabilitiesProvider();
    if (this.mode === "pullRequests" && !capabilities.pullRequests) {
      return [new MessageNode("Pull requests endpoint not available in this Gitea instance.")];
    }
    if ((this.mode === "runs" || this.mode === "workflows") && !capabilities.runs) {
      return [new MessageNode("Actions runs endpoint not available in this Gitea instance.")];
    }

    if (this.store.isReposLoading()) {
      return [new MessageNode("Discovering repositories...")];
    }

    const repos = this.store.getRepos();
    if (!repos.length) {
      return [new MessageNode("No repositories found.")];
    }

    if (this.mode === "workflows") {
      const groups = this.buildWorkflowGroups();
      if (!groups.length) {
        return [new MessageNode("No runs yet.")];
      }
      return groups;
    }

    const autoExpand = repos.length === 1;

    return repos.map((repo) => {
      if (this.mode === "pullRequests") {
        const entry = this.store.getEntry(repo);
        const count = entry?.pullRequests.length ?? 0;
        const description = `${count} open`;
        return new RepoNode(
          repo,
          autoExpand || this.isExpanded(expandedRepoKey(repo)),
          description,
        );
      }
      const entry = this.store.getEntry(repo);
      const description = entry?.repoStatus ? `status: ${entry.repoStatus.state}` : undefined;
      return new RepoNode(repo, autoExpand || this.isExpanded(expandedRepoKey(repo)), description);
    });
  }

  private getRepoChildren(repo: RepoRef): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [new MessageNode("No data yet.")];
    }

    if (entry.loading) {
      return [new MessageNode("Loading runs...")];
    }

    if (entry.error) {
      return [new ErrorNode(entry.error)];
    }

    if (this.mode === "pullRequests") {
      if (!entry.pullRequests.length) {
        return [new MessageNode("No pull requests found.")];
      }
      const nodes: TreeNode[] = entry.pullRequests.map((pr) => new PullRequestNode(repo, pr));
      if (entry.errors.length) {
        nodes.push(new SectionNode("errors", "Errors", repo));
      }
      return nodes;
    }

    const runs = this.filterRuns(entry.runs);
    const nodes: TreeNode[] = runs.map(
      (run) => new RunNode(repo, run, this.isExpanded(expandedRunKey(repo, run.id))),
    );

    if (entry.errors.length) {
      nodes.push(new SectionNode("errors", "Errors", repo));
    }

    if (!nodes.length) {
      nodes.push(new MessageNode("No workflow runs found."));
    }

    return nodes;
  }

  private getRunChildren(repo: RepoRef, run: WorkflowRun): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [new MessageNode("No job data yet.")];
    }

    const runKey = String(run.id);
    const state = entry.jobsStateByRun.get(runKey) ?? "unloaded";
    const error = entry.jobsErrorByRun.get(runKey);
    if (state === "unloaded") {
      return [new MessageNode("Expand to load jobs.")];
    }
    if (state === "loading") {
      return [new MessageNode("Loading jobs...")];
    }
    if (state === "error") {
      return [new ErrorNode(error ?? "Failed to load jobs.")];
    }

    const jobs = entry.jobsByRun.get(runKey) ?? [];
    const nodes: TreeNode[] = jobs.map((job) => new JobNode(repo, run, job));

    const artifacts = entry.artifactsByRun.get(runKey) ?? [];
    if (artifacts.length) {
      nodes.push(new SectionNode("artifacts", "Artifacts", repo, run.id));
    }

    if (!nodes.length) {
      nodes.push(new MessageNode("No jobs found for this run."));
    }

    return nodes;
  }

  private getJobChildren(repo: RepoRef, run: WorkflowRun, job: Job): TreeNode[] {
    const steps = job.steps ?? [];
    if (!steps.length) {
      return [new MessageNode("No steps reported.")];
    }
    return steps.map((step) => new StepNode(repo, run, job, step));
  }

  private getPullRequestChildren(repo: RepoRef): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [];
    }
    if (!entry.pullRequests.length) {
      return [new MessageNode("No pull requests found.")];
    }
    return entry.pullRequests.map((pr) => new PullRequestNode(repo, pr));
  }

  private getArtifactChildren(repo: RepoRef, runId: number | string): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [];
    }
    const artifacts = entry.artifactsByRun.get(String(runId)) ?? [];
    if (!artifacts.length) {
      return [new MessageNode("No artifacts found.")];
    }
    return artifacts.map((artifact) => new ArtifactNode(repo, artifact));
  }

  private getErrorChildren(repo: RepoRef): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [];
    }
    if (!entry.errors.length) {
      return [new MessageNode("No errors recorded.")];
    }
    return entry.errors.map((message) => new ErrorNode(message));
  }

  private buildWorkflowGroups(): WorkflowGroupNode[] {
    const entries = this.store.getEntries();
    const groups = new Map<string, { name: string; runs: { repo: RepoRef; run: WorkflowRun }[] }>();

    for (const entry of entries) {
      if (entry.error) {
        continue;
      }
      for (const run of this.filterRuns(entry.runs)) {
        const branchName = run.branch ?? "unknown";
        const existing = groups.get(branchName);
        if (!existing) {
          groups.set(branchName, {
            name: branchName,
            runs: [{ repo: entry.repo, run }],
          });
        } else {
          existing.runs.push({ repo: entry.repo, run });
        }
      }
    }

    const ordered = Array.from(groups.values()).sort((a, b) => {
      const aActive = a.runs.some(
        (entry) => entry.run.status === "running" || entry.run.status === "queued",
      );
      const bActive = b.runs.some(
        (entry) => entry.run.status === "running" || entry.run.status === "queued",
      );
      if (aActive && !bActive) {
        return -1;
      }
      if (!aActive && bActive) {
        return 1;
      }
      const aTime = a.runs[0]?.run.updatedAt ?? a.runs[0]?.run.createdAt ?? "";
      const bTime = b.runs[0]?.run.updatedAt ?? b.runs[0]?.run.createdAt ?? "";
      return bTime.localeCompare(aTime);
    });

    return ordered.map(
      (group) =>
        new WorkflowGroupNode(
          group.name,
          group.runs,
          this.isExpanded(expandedWorkflowKey(group.name)),
        ),
    );
  }

  private isExpanded(key: string): boolean {
    return this.expanded.has(key);
  }

  private filterRuns(runs: WorkflowRun[]): WorkflowRun[] {
    const settings = getSettings();
    const branchFilter = settings.actionsFilterBranch.trim().toLowerCase();
    const statusFilter = settings.actionsFilterStatus.trim().toLowerCase();
    const eventFilter = settings.actionsFilterEvent.trim().toLowerCase();
    const searchFilter = settings.actionsFilterSearch.trim().toLowerCase();

    if (!branchFilter && !statusFilter && !eventFilter && !searchFilter) {
      return runs;
    }

    return runs.filter((run) => {
      if (branchFilter && !(run.branch ?? "").toLowerCase().includes(branchFilter)) {
        return false;
      }
      if (eventFilter && !(run.event ?? "").toLowerCase().includes(eventFilter)) {
        return false;
      }
      if (statusFilter) {
        const status = run.status.toLowerCase();
        const conclusion = (run.conclusion ?? "").toLowerCase();
        if (!status.includes(statusFilter) && !conclusion.includes(statusFilter)) {
          return false;
        }
      }
      if (searchFilter) {
        const haystack = `${run.name} ${run.workflowName ?? ""} ${run.displayTitle ?? ""} ${
          run.branch ?? ""
        } ${run.event ?? ""}`.toLowerCase();
        if (!haystack.includes(searchFilter)) {
          return false;
        }
      }
      return true;
    });
  }
}
