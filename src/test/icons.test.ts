/**
 * Unit tests for views/icons (iconForStatus).
 */
import { iconForStatus } from "../views/icons";
import { ThemeIcon } from "./__mocks__/vscode";

describe("iconForStatus", () => {
  it("returns sync~spin for running", () => {
    const icon = iconForStatus("running");
    expect(icon).toBeInstanceOf(ThemeIcon);
    expect((icon as ThemeIcon).id).toBe("sync~spin");
  });

  it("returns clock for queued", () => {
    const icon = iconForStatus("queued");
    expect(icon).toBeInstanceOf(ThemeIcon);
    expect((icon as ThemeIcon).id).toBe("clock");
  });

  it("returns check for conclusion success", () => {
    const icon = iconForStatus("completed", "success");
    expect((icon as ThemeIcon).id).toBe("check");
  });

  it("returns error for conclusion failure", () => {
    const icon = iconForStatus("completed", "failure");
    expect((icon as ThemeIcon).id).toBe("error");
  });

  it("returns circle-slash for conclusion cancelled", () => {
    const icon = iconForStatus("completed", "cancelled");
    expect((icon as ThemeIcon).id).toBe("circle-slash");
  });

  it("returns debug-step-over for conclusion skipped", () => {
    const icon = iconForStatus("completed", "skipped");
    expect((icon as ThemeIcon).id).toBe("debug-step-over");
  });

  it("returns question for unknown/default conclusion", () => {
    const icon = iconForStatus("completed");
    expect((icon as ThemeIcon).id).toBe("question");
  });

  it("returns question for unknown conclusion value", () => {
    const icon = iconForStatus("completed", "unknown" as never);
    expect((icon as ThemeIcon).id).toBe("question");
  });
});
