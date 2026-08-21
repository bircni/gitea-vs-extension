/**
 * Starts the GitHub Actions language server for Gitea workflow files: schema validation, expression
 * validation, completion and hover docs.
 *
 * Deliberately offline. We never pass `sessionToken`, `repos` or `gitHubApiUrl`, because those only
 * make the server talk to github.com — a Gitea token is useless there. The cost is that `uses:`
 * action inputs are not validated; everything else works without any network access.
 */
import path from "node:path";
import * as vscode from "vscode";
import { Requests, type ReadFileRequest } from "@actions/languageserver/request";
import { LanguageClient, TransportKind, type ServerOptions } from "vscode-languageclient/node";
import type { LanguageClientOptions } from "vscode-languageclient";
import {
  ACTION_PATTERN,
  GITEA_WORKFLOW_PATTERN,
  GITHUB_WORKFLOW_PATTERN,
} from "./documentSelector";
import { buildInitializationOptions } from "./initializationOptions";
import { isWorkspaceFileUri } from "./readFilePolicy";

let client: LanguageClient | undefined;

export async function startLanguageServer(
  context: vscode.ExtensionContext,
  debugLogging: boolean,
): Promise<void> {
  if (client) {
    return;
  }

  const module = context.asAbsolutePath(path.join("dist", "server-node.cjs"));
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6011"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { pattern: GITEA_WORKFLOW_PATTERN },
      { pattern: GITHUB_WORKFLOW_PATTERN },
      { pattern: ACTION_PATTERN },
    ],
    initializationOptions: buildInitializationOptions(debugLogging),
    progressOnInitialization: true,
  };

  client = new LanguageClient(
    "gitea-actions-language",
    "Gitea Actions Language Server",
    serverOptions,
    clientOptions,
  );

  // The server asks us to read files it cannot reach itself, e.g. a local reusable workflow.
  client.onRequest(Requests.ReadFile, async (event: ReadFileRequest) => {
    if (typeof event?.path !== "string") {
      return null;
    }
    try {
      const uri = vscode.Uri.parse(event.path);
      if (!isWorkspaceFileUri(uri, vscode.workspace.workspaceFolders)) {
        return null;
      }
      const content = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(content);
    } catch {
      return null;
    }
  });

  await client.start();
}

export async function stopLanguageServer(): Promise<void> {
  const running = client;
  client = undefined;
  await running?.stop();
}
