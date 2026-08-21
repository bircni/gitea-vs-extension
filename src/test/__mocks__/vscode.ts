export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string } }[] | undefined,
  getConfiguration: vi.fn(),
};

export const window = {
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    dispose: vi.fn(),
  })),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath, scheme: "file" }),
  parse: (value: string) => {
    const scheme = /^(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value)?.groups?.scheme ?? "file";
    return { fsPath: scheme === "file" ? value.replace(/^file:\/\//, "") : "", scheme };
  },
};

/** Minimal TreeItem for tests that use views/nodes (e.g. ArtifactNode). */
export class TreeItem {
  constructor(
    public label: string,
    public collapsibleState?: unknown,
  ) {}
}

/* eslint-disable @typescript-eslint/naming-convention -- mirrors VS Code API */
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}
/* eslint-enable @typescript-eslint/naming-convention */

export const commands = {
  executeCommand: vi.fn().mockResolvedValue(),
  registerCommand: vi.fn((_id: string, handler: (...args: unknown[]) => unknown) => ({
    dispose: vi.fn(),
    _handler: handler,
  })),
};

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  fire(data: T): void {
    for (const l of this.listeners) {
      l(data);
    }
  }
  get event(): (listener: (e: T) => void) => { dispose: () => void } {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          this.listeners = this.listeners.filter((l) => l !== listener);
        },
      };
    };
  }
}

export const env = {
  openExternal: vi.fn().mockResolvedValue(),
  clipboard: { writeText: vi.fn().mockResolvedValue() },
};

export class ThemeColor {
  constructor(public id: string) {}
}

export class ThemeIcon {
  constructor(
    public id: string,
    _color?: ThemeColor,
  ) {}
}
