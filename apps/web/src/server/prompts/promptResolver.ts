import { readFileSync } from "node:fs";
import { join } from "node:path";

type PromptModule = "analysis" | "coaching" | "repair" | "judge";

type PromptManifest = {
  active: Record<PromptModule, string>;
  versions: Record<
    PromptModule,
    Record<
      string,
      {
        system: string;
        userTemplate: string;
      }
    >
  >;
};

export type ResolvedPrompt = {
  module: PromptModule;
  version: string;
  system: string;
  userTemplate: string;
};

export function createPromptResolver(promptRoot = join(process.cwd(), "src", "prompts")) {
  const manifest = readManifest(promptRoot);

  return {
    getActivePrompt(module: PromptModule): ResolvedPrompt {
      const version = manifest.active[module];

      if (!version) {
        throw new Error(`No active prompt configured for ${module}.`);
      }

      return resolvePrompt(promptRoot, manifest, module, version);
    },

    getPrompt(module: PromptModule, version: string): ResolvedPrompt {
      return resolvePrompt(promptRoot, manifest, module, version);
    }
  };
}

function readManifest(promptRoot: string): PromptManifest {
  const manifestPath = join(promptRoot, "versioning", "manifest.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PromptManifest;
}

function resolvePrompt(
  promptRoot: string,
  manifest: PromptManifest,
  module: PromptModule,
  version: string
): ResolvedPrompt {
  const entry = manifest.versions[module]?.[version];

  if (!entry) {
    throw new Error(`Prompt ${module}:${version} was not found.`);
  }

  return {
    module,
    version,
    system: readFileSync(join(promptRoot, entry.system), "utf8"),
    userTemplate: readFileSync(join(promptRoot, entry.userTemplate), "utf8")
  };
}
