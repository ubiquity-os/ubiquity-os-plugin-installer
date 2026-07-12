import YAML from "yaml";
import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { getMarketplacePluginId, getPluginIdentifierAliases } from "../static/scripts/plugin-identifiers";
import { ManifestPreDecode, Plugin } from "../static/types/plugins";

const legacyWorkerUrl = "https://ubiquity-os-comment-vector-embeddings-development.ubiquity.workers.dev";
const canonicalPluginId = "ubiquity-os-marketplace/text-vector-embeddings";

const storage = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) || null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});

Object.defineProperty(globalThis, "document", {
  value: {
    getElementById: () => null,
  },
});

let configParserClass: typeof import("../static/scripts/config-parser").ConfigParser;

beforeAll(async () => {
  ({ ConfigParser: configParserClass } = await import("../static/scripts/config-parser"));
});

function createPluginManifest(): ManifestPreDecode {
  return {
    homepageUrl: legacyWorkerUrl,
    repository: "text-vector-embeddings",
    manifest: {
      name: "Comment Vector Embeddings",
    } as ManifestPreDecode["manifest"],
  };
}

function createPlugin(withConfig: Record<string, unknown> = {}): Plugin {
  return {
    uses: [
      {
        plugin: canonicalPluginId,
        with: withConfig,
      },
    ],
  };
}

describe("plugin identifiers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds marketplace org/repo plugin identifiers from repository names", () => {
    const manifest = createPluginManifest();

    expect(getMarketplacePluginId(manifest)).toBe(canonicalPluginId);
    expect(getPluginIdentifierAliases(manifest)).toContain(legacyWorkerUrl);
  });

  it("updates legacy URL config entries instead of duplicating them", () => {
    const parser = new configParserClass();
    parser.repoConfig = YAML.stringify({
      plugins: [
        {
          uses: [
            {
              plugin: legacyWorkerUrl,
              with: { old: true },
            },
          ],
        },
      ],
    });

    parser.addPlugin(createPlugin({ updated: true }), [legacyWorkerUrl]);

    const parsed = YAML.parse(parser.newConfigYml || "");
    expect(parsed.plugins).toHaveLength(1);
    expect(parsed.plugins[0].uses[0].plugin).toBe(canonicalPluginId);
    expect(parsed.plugins[0].uses[0].with).toEqual({ updated: true });
  });

  it("removes legacy URL config entries using the canonical plugin identifier", () => {
    const parser = new configParserClass();
    parser.repoConfig = YAML.stringify({
      plugins: [
        {
          uses: [
            {
              plugin: legacyWorkerUrl,
              with: { old: true },
            },
          ],
        },
        {
          uses: [
            {
              plugin: "ubiquity-os-marketplace/command-start-stop",
              with: {},
            },
          ],
        },
      ],
    });

    parser.removePlugin(createPlugin(), [legacyWorkerUrl]);

    const parsed = YAML.parse(parser.newConfigYml || "");
    expect(parsed.plugins).toHaveLength(1);
    expect(parsed.plugins[0].uses[0].plugin).toBe("ubiquity-os-marketplace/command-start-stop");
  });
});
