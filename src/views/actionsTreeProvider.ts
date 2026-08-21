import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import { getEffectiveToken } from "../config/secrets";
import type { RepoStateStore } from "../util/cache";
import { expandedRepoKey, expandedRunKey, expandedWorkflowKey } from "../util/expandedState";
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
import type { Job, RepoRef, Step, WorkflowRun } from "../gitea/models";
import {
  buildWorkflowGroupDescriptors,
  getBranchFilterDescription,
  getRepoChildRunsState,
  getRootMessage,
  type ProviderMode,
} from "./actionsTreeHelpers";

export type { ProviderMode } from "./actionsTreeHelpers";

export class ActionsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly mode: ProviderMode,
    private readonly store: RepoStateStore,
    private readonly secrets: vscode.SecretStorage,
    private readonly expanded: Set<string>,
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
    const instanceUrls = settings.instanceUrls ?? (settings.baseUrl ? [settings.baseUrl] : []);
    const hasBaseUrl = instanceUrls.length > 0;
    const tokens = await Promise.all(
      instanceUrls.map((baseUrl) =>
        getEffectiveToken(this.secrets, baseUrl, baseUrl === settings.baseUrl),
      ),
    );
    const reposLoading = this.store.isReposLoading();
    const repos = this.store.getRepos();
    const workflowDescriptors =
      this.mode === "workflows" ? buildWorkflowGroupDescriptors(this.store.getEntries()) : [];

    const rootMsg = getRootMessage(
      hasBaseUrl,
      tokens.some(Boolean),
      reposLoading,
      repos.length,
      this.mode,
      workflowDescriptors.length,
    );
    if (rootMsg) {
      return [new MessageNode(rootMsg.label, "info", rootMsg.command)];
    }

    if (this.mode === "workflows") {
      return workflowDescriptors.flatMap<TreeNode>((group) =>
        group.fallback
          ? group.runs.map(
              (entry) =>
                new RunNode(
                  entry.repo,
                  entry.run,
                  this.isExpanded(expandedRunKey(entry.repo, entry.run.id)),
                ),
            )
          : [
              new WorkflowGroupNode(
                group.name,
                group.runs,
                this.isExpanded(expandedWorkflowKey(group.name)),
              ),
            ],
      );
    }

    // "Current Branch" with a single repo: the repo node is a redundant collapse level, so
    // render its runs directly at the root. Multiple repos keep the repo grouping to stay distinct.
    if (this.mode === "runs" && repos.length === 1) {
      return this.getRepoChildren(repos[0]);
    }

    const autoExpand = repos.length === 1;
    return repos.map((repo) => {
      const entry = this.store.getEntry(repo);
      const filterDesc = getBranchFilterDescription(
        this.mode,
        this.store.getBranchContext(repo),
        this.store.getBranchFilter(repo),
      );
      const statusDesc = entry?.repoStatus ? `status: ${entry.repoStatus.state}` : undefined;
      const description = [filterDesc, statusDesc].filter(Boolean).join(" · ") || undefined;
      return new RepoNode(repo, autoExpand || this.isExpanded(expandedRepoKey(repo)), description);
    });
  }

  private getRepoChildren(repo: RepoRef): TreeNode[] {
    const entry = this.store.getEntry(repo);
    const context = this.store.getBranchContext(repo);
    const filter = this.store.getBranchFilter(repo);

    const state = getRepoChildRunsState(entry, context ?? undefined, filter ?? undefined);
    const matchingPullRequest =
      context?.branchName && entry
        ? entry.pullRequests.find((pullRequest) => pullRequest.headRef === context.branchName)
        : undefined;
    const nodes: TreeNode[] = matchingPullRequest
      ? [new PullRequestNode(repo, matchingPullRequest)]
      : [];
    if (state.noEntry) {
      return [...nodes, new MessageNode("No data yet.")];
    }
    if (state.loading) {
      return [...nodes, new MessageNode("Loading runs...")];
    }
    if (state.error) {
      return [...nodes, new ErrorNode(state.error)];
    }
    if (state.emptyMessage && state.filteredRuns.length === 0) {
      return [
        ...nodes,
        new MessageNode(state.emptyMessage.label, "info", state.emptyMessage.command),
      ];
    }

    if (state.infoBanner) {
      nodes.push(new MessageNode(state.infoBanner.label, "info", state.infoBanner.command));
    }
    nodes.push(
      ...state.filteredRuns.map(
        (run) => new RunNode(repo, run, this.isExpanded(expandedRunKey(repo, run.id))),
      ),
    );
    if (state.hasErrorsSection) {
      nodes.push(new SectionNode("errors", "Errors", repo));
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
    if (state === "unloaded") {
      return [new MessageNode("Expand to load jobs.")];
    }
    if (state === "loading") {
      return [new MessageNode("Loading jobs...")];
    }
    if (state === "error") {
      return [new ErrorNode(entry.jobsErrorByRun.get(runKey) ?? "Failed to load jobs.")];
    }

    const jobs = [...(entry.jobsByRun.get(runKey) ?? [])].toSorted(compareJobsForFailureFirst);
    const nodes: TreeNode[] = jobs.map((job) => new JobNode(repo, run, job));

    const artifacts = entry.artifactsByRun.get(runKey) ?? [];
    if (artifacts.length > 0) {
      nodes.push(new SectionNode("artifacts", "Artifacts", repo, run.id));
    }

    if (nodes.length === 0) {
      nodes.push(new MessageNode("No jobs found for this run."));
    }

    return nodes;
  }

  private getJobChildren(repo: RepoRef, run: WorkflowRun, job: Job): TreeNode[] {
    const steps = [...(job.steps ?? [])].toSorted(compareStepsForFailureFirst);
    if (steps.length === 0) {
      return [new MessageNode("No steps reported.")];
    }
    return steps.map((step) => new StepNode(repo, run, job, step));
  }

  private getArtifactChildren(repo: RepoRef, runId: number | string): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [];
    }
    const artifacts = entry.artifactsByRun.get(String(runId)) ?? [];
    if (artifacts.length === 0) {
      return [new MessageNode("No artifacts found.")];
    }
    return artifacts.map((artifact) => new ArtifactNode(repo, runId, artifact));
  }

  private getErrorChildren(repo: RepoRef): TreeNode[] {
    const entry = this.store.getEntry(repo);
    if (!entry) {
      return [];
    }
    if (entry.errors.length === 0) {
      return [new MessageNode("No errors recorded.")];
    }
    return entry.errors.map((message) => new ErrorNode(message));
  }

  private isExpanded(key: string): boolean {
    return this.expanded.has(key);
  }
}

function compareJobsForFailureFirst(a: Job, b: Job): number {
  const aFailed = a.conclusion === "failure";
  const bFailed = b.conclusion === "failure";
  if (aFailed !== bFailed) {
    return aFailed ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function compareStepsForFailureFirst(a: Step, b: Step): number {
  const aFailed = a.conclusion === "failure";
  const bFailed = b.conclusion === "failure";
  if (aFailed !== bFailed) {
    return aFailed ? -1 : 1;
  }
  return (a.name ?? "").localeCompare(b.name ?? "");
}
