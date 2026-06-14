import path from "node:path";
import { globSync } from "glob";
// Mocha's runtime export is the constructor (PascalCase).
// eslint-disable-next-line @typescript-eslint/naming-convention -- external API
import Mocha from "mocha";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 120_000 });
  const testsRoot = path.resolve(__dirname, ".");
  for (const f of globSync("**/*.test.js", { cwd: testsRoot })) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${String(failures)} test(s) failed`));
      } else {
        resolve();
      }
    });
  });
}
