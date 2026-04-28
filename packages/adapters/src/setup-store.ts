import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ControllerSetup, SetupStore } from "../../core/src/index.js";

export class FileSetupStore implements SetupStore {
  constructor(private readonly path = process.env.AUTO_FORGE_SETUP_PATH ?? ".auto-forge/setup.json") {}

  async read(): Promise<ControllerSetup | undefined> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as ControllerSetup;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async write(setup: ControllerSetup): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(setup, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.path);
  }
}
