import {
  extractRepoFromSelection,
  getExpandedKey,
  loadExpandedState,
  updateExpandedState,
  updateStatusBar,
} from "../util/bootstrap";
import {
  JobNode,
  PullRequestNode,
  RepoNode,
  RunNode,
  StepNode,
  WorkflowGroupNode,
} from "../views/nodes";
import type { RepoRef, WorkflowRun } from "../gitea/models";

function repo(owner: string, name: string): RepoRef {
  return { host: "gitea.example", owner, name };
}

function run(id: number, branch: string): WorkflowRun {
  return { id, name: "wf", branch, status: "completed" };
}

describe("bootstrap helpers", () => {
  describe("extractRepoFromSelection", () => {
    it("returns repo from RepoNode", () => {
      const r = repo("o", "n");
      const node = new RepoNode(r, false);
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns repo from RunNode", () => {
      const r = repo("o", "n");
      const node = new RunNode(r, run(1, "main"), false);
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns repo from JobNode", () => {
      const r = repo("o", "n");
      const wfRun = run(1, "main");
      const node = new JobNode(r, wfRun, { id: 1, name: "job", status: "completed" });
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns repo from StepNode", () => {
      const r = repo("o", "n");
      const wfRun = run(1, "main");
      const job = { id: 1, name: "job", status: "completed" as const };
      const node = new StepNode(r, wfRun, job, { name: "step", status: "completed" });
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns repo from WorkflowGroupNode (first run)", () => {
      const r = repo("o", "n");
      const node = new WorkflowGroupNode("main", [{ repo: r, run: run(1, "main") }], false);
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns repo from PullRequestNode", () => {
      const r = repo("o", "n");
      const node = new PullRequestNode(r, { id: 1, number: 42, title: "PR", state: "open" });
      expect(extractRepoFromSelection([node])).toEqual(r);
    });

    it("returns undefined for empty selection", () => {
      expect(extractRepoFromSelection([])).toBeUndefined();
    });

    it("returns undefined for non-node selection", () => {
      expect(extractRepoFromSelection([{ label: "other" }])).toBeUndefined();
    });

    it("uses first repo-bearing element", () => {
      const r1 = repo("o1", "n1");
      const r2 = repo("o2", "n2");
      const node1 = new RepoNode(r1, false);
      const node2 = new RepoNode(r2, false);
      expect(extractRepoFromSelection([node1, node2])).toEqual(r1);
    });
  });

  describe("getExpandedKey", () => {
    it("returns repo key for RepoNode", () => {
      const r = repo("o", "n");
      const node = new RepoNode(r, false);
      expect(getExpandedKey(node)).toBe("repo:gitea.example/o/n");
    });

    it("returns run key for RunNode", () => {
      const r = repo("o", "n");
      const node = new RunNode(r, run(1, "main"), false);
      expect(getExpandedKey(node)).toBe("run:gitea.example/o/n/1");
    });

    it("returns workflow key for WorkflowGroupNode", () => {
      const node = new WorkflowGroupNode("main", [], false);
      expect(getExpandedKey(node)).toBe("workflow:main");
    });

    it("returns undefined for unknown element", () => {
      expect(getExpandedKey({})).toBeUndefined();
      expect(
        getExpandedKey(
          new PullRequestNode(repo("o", "n"), { id: 1, number: 1, title: "x", state: "open" }),
        ),
      ).toBeUndefined();
    });
  });

  describe("loadExpandedState", () => {
    it("returns empty set when no stored state", () => {
      const storage = { get: vi.fn().mockReturnValue() };
      expect(loadExpandedState(storage as never)).toEqual(new Set());
    });

    it("returns set from stored array", () => {
      const storage = { get: vi.fn().mockReturnValue(["a", "b"]) };
      expect(loadExpandedState(storage as never)).toEqual(new Set(["a", "b"]));
    });
  });

  describe("updateExpandedState", () => {
    it("adds key and updates storage when expanding", () => {
      const expanded = new Set<string>();
      const updates: [string, unknown][] = [];
      const storage = {
        update: vi.fn((key: string, value: unknown) => {
          updates.push([key, value]);
        }),
      };
      const r = repo("o", "n");
      const node = new RepoNode(r, false);

      updateExpandedState(expanded, storage as never, node, true);

      expect(expanded.has("repo:gitea.example/o/n")).toBe(true);
      expect(storage.update).toHaveBeenCalledWith("gitea-vs-extension.expandedNodes", [
        "repo:gitea.example/o/n",
      ]);
    });

    it("removes key when collapsing", () => {
      const expanded = new Set(["repo:gitea.example/o/n"]);
      const storage = { update: vi.fn() };
      const node = new RepoNode(repo("o", "n"), false);

      updateExpandedState(expanded, storage as never, node, false);

      expect(expanded.has("repo:gitea.example/o/n")).toBe(false);
      expect(storage.update).toHaveBeenCalledWith("gitea-vs-extension.expandedNodes", []);
    });

    it("does nothing for element without expanded key", () => {
      const expanded = new Set<string>();
      const storage = { update: vi.fn() };
      updateExpandedState(expanded, storage as never, { label: "other" }, true);
      expect(expanded.size).toBe(0);
      expect(storage.update).not.toHaveBeenCalled();
    });
  });

  describe("updateStatusBar", () => {
    it("sets text with running and failed counts", () => {
      const item = { text: "", show: vi.fn() };
      updateStatusBar(item as never, { runningCount: 2, failedCount: 1 });
      expect(item.text).toBe("Gitea: 2 running, 1 failed");
    });
  });
});
