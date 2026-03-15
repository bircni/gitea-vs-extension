export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string } }[] | undefined,
};

export const window = {
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    dispose: jest.fn(),
  })),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
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
  executeCommand: jest.fn().mockResolvedValue(undefined),
  registerCommand: jest.fn((_id: string, handler: (...args: unknown[]) => unknown) => ({
    dispose: jest.fn(),
    _handler: handler,
  })),
};

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  fire(data: T): void {
    this.listeners.forEach((l) => l(data));
  }
  get event(): (listener: (e: T) => void) => { dispose(): void } {
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
  openExternal: jest.fn().mockResolvedValue(undefined),
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
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
