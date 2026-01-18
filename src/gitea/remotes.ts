export type RemoteInfo = {
  host: string;
  owner: string;
  repo: string;
};

export function parseRemoteUrl(remoteUrl: string): RemoteInfo | undefined {
  const trimmed = remoteUrl.trim();

  const httpsMatch = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (httpsMatch) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  const sshMatch = /^ssh:\/\/[^@]+@([^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(
    trimmed,
  );
  if (sshMatch?.groups?.owner && sshMatch.groups.repo) {
    return {
      host: sshMatch[1],
      owner: sshMatch.groups.owner,
      repo: sshMatch.groups.repo,
    };
  }

  const scpMatch = /^[^@]+@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (scpMatch) {
    return {
      host: scpMatch[1],
      owner: scpMatch[2],
      repo: scpMatch[3],
    };
  }

  return undefined;
}

export function normalizeHost(host: string): string {
  return host.toLowerCase();
}

export function hostMatches(baseHost: string, remoteHost: string): boolean {
  const normalizedBase = normalizeHost(baseHost);
  const normalizedRemote = normalizeHost(remoteHost);
  if (normalizedBase === normalizedRemote) {
    return true;
  }
  const baseHostname = normalizedBase.split(":")[0];
  const remoteHostname = normalizedRemote.split(":")[0];
  return baseHostname === remoteHostname;
}
