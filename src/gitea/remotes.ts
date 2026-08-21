export type RemoteInfo = {
  host: string;
  owner: string;
  repo: string;
  transport: "web" | "ssh";
};

export function parseRemoteUrl(remoteUrl: string): RemoteInfo | undefined {
  const trimmed = remoteUrl.trim();

  const httpsMatch =
    /^https?:\/\/(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (httpsMatch) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
      transport: "web",
    };
  }

  const sshMatch =
    /^ssh:\/\/[^@]+@(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch?.groups?.owner && sshMatch.groups.repo) {
    return {
      host: sshMatch[1],
      owner: sshMatch.groups.owner,
      repo: sshMatch.groups.repo,
      transport: "ssh",
    };
  }

  const scpMatch = /^[^@]+@(?<host>[^:]+):(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/i.exec(
    trimmed,
  );
  if (scpMatch) {
    return {
      host: scpMatch[1],
      owner: scpMatch[2],
      repo: scpMatch[3],
      transport: "ssh",
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
  const baseHostname = normalizedBase.split(":", 1)[0];
  const remoteHostname = normalizedRemote.split(":", 1)[0];
  return baseHostname === remoteHostname;
}

/**
 * HTTP(S) remotes identify the Gitea web endpoint, so their port must match a configured base URL.
 * URL parsing also treats an explicit default HTTPS port as equivalent to an omitted one.
 */
export function webHostMatches(baseHost: string, remoteHost: string): boolean {
  try {
    return (
      new URL(`https://${baseHost}`).host.toLowerCase() ===
      new URL(`https://${remoteHost}`).host.toLowerCase()
    );
  } catch {
    return normalizeHost(baseHost) === normalizeHost(remoteHost);
  }
}
