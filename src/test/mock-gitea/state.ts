export type MockState = {
  secrets: Map<string, { description?: string }>;
  variables: Map<string, { name: string; value?: string; data?: string; description?: string }>;
  reviewComments: Map<number, { id: number; body?: string; path?: string; line?: number }[]>;
  nextReviewId: number;
  nextReviewCommentId: number;
};

export function createInitialState(): MockState {
  return {
    secrets: new Map(),
    variables: new Map(),
    reviewComments: new Map(),
    nextReviewId: 402,
    nextReviewCommentId: 502,
  };
}
