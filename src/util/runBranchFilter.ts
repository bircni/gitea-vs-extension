import type { WorkflowRun } from "../gitea/models";

type SelectBranchRunsArgs = {
  runs: WorkflowRun[];
  currentBranch?: string;
  branchWarning?: string;
};

export type BranchRunsSelection = {
  runs: WorkflowRun[];
  warning?: string;
  emptyMessage?: string;
};

export function selectBranchRuns(args: SelectBranchRunsArgs): BranchRunsSelection {
  if (args.branchWarning) {
    return {
      runs: [],
      warning: args.branchWarning,
    };
  }

  const branchName = args.currentBranch ?? "unknown";
  const runs = args.currentBranch
    ? args.runs.filter((run) => run.branch === args.currentBranch)
    : [];

  if (runs.length > 0) {
    return { runs };
  }

  return {
    runs: [],
    emptyMessage: `No workflow runs found for branch "${branchName}".`,
  };
}
