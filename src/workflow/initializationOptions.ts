/**
 * What we hand the workflow language server on startup.
 *
 * Kept out of `languageServer.ts` so it can be tested without loading `vscode-languageclient`,
 * which requires the real VS Code runtime.
 */
import {
  LogLevel,
  type InitializationOptions,
} from "@actions/languageserver/initializationOptions";

/**
 * Deliberately no `sessionToken`, `repos` or `gitHubApiUrl`: those only make the server call
 * github.com, where a Gitea token is useless. Everything but `uses:` input validation works offline.
 */
export function buildInitializationOptions(debugLogging: boolean): InitializationOptions {
  return {
    logLevel: debugLogging ? LogLevel.Debug : LogLevel.Warn,
    experimentalFeatures: { allowCaseFunction: true, allowBackgroundSteps: true },
  };
}
