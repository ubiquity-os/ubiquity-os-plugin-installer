import { describe, expect, it } from "@jest/globals";
import { resolvePluginReference } from "../static/scripts/rendering/utils";

describe("resolvePluginReference", () => {
  const repository = "ubiquity-os-marketplace/text-vector-embeddings";

  it("prefers the explicit marketplace repository slug", () => {
    expect(
      resolvePluginReference({
        manifest: { name: "text-vector-embeddings" },
        repository,
        homepageUrl: "https://ubiquity-os-text-vector-embeddings-development.ubiquity.workers.dev",
      })
    ).toBe(repository);
  });

  it("keeps an existing owner/repo homepage reference", () => {
    expect(
      resolvePluginReference({
        manifest: { name: "text-vector-embeddings" },
        homepageUrl: repository,
      })
    ).toBe(repository);
  });

  it("falls back to a marketplace slug derived from the manifest name", () => {
    expect(
      resolvePluginReference({
        manifest: { name: "Text Vector Embeddings" },
        homepageUrl: "https://ubiquity-os-text-vector-embeddings-development.ubiquity.workers.dev",
      })
    ).toBe(repository);
  });
});
