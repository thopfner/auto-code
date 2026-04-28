import type { SecretRef } from "../../core/src/index.js";

export interface SecretResolver {
  resolve(ref: SecretRef): Promise<string | undefined>;
}

export class EnvSecretResolver implements SecretResolver {
  async resolve(ref: SecretRef): Promise<string | undefined> {
    if (!ref.startsWith("env:")) {
      return undefined;
    }

    const name = ref.slice("env:".length);
    return process.env[name];
  }
}
