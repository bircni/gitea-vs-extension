export type MockState = {
  secrets: Map<string, { description?: string }>;
  variables: Map<string, { name: string; value?: string; data?: string; description?: string }>;
};

export function createInitialState(): MockState {
  return {
    secrets: new Map(),
    variables: new Map(),
  };
}
