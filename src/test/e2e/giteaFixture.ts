export type GiteaFixtureMetadata = {
  image: string;
  username: string;
  password: string;
  owner: string;
  repo: string;
  branch: string;
  commentFile: string;
  commentLine: number;
  seededReviewCommentCount: number;
};

export const GITEA_FIXTURE_ARCHIVE = "gitea-1.26.1-fixture.tar.gz";
