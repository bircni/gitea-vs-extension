export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string } }[] | undefined,
};

export const window = {
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
};
