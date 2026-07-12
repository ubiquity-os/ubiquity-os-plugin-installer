import { ManifestPreDecode } from "../types/plugins";

const MARKETPLACE_ORG = "ubiquity-os-marketplace";

export function normalizePluginName(pluginName: string): string {
  return pluginName
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export function getMarketplacePluginId(pluginManifest: ManifestPreDecode): string {
  const repository = pluginManifest.repository || pluginManifest.manifest.name;
  const normalizedRepository = normalizePluginName(repository);

  if (!normalizedRepository) {
    throw new Error("No plugin repository found");
  }

  return `${MARKETPLACE_ORG}/${normalizedRepository}`;
}

export function getPluginIdentifierAliases(pluginManifest: ManifestPreDecode): string[] {
  const canonicalPluginId = getMarketplacePluginId(pluginManifest);
  const aliases = [pluginManifest.homepageUrl, pluginManifest.repository, pluginManifest.manifest.name, normalizePluginName(pluginManifest.manifest.name)];

  return Array.from(new Set(aliases.filter((alias): alias is string => Boolean(alias) && alias !== canonicalPluginId)));
}

export function pluginReferenceMatches(currentReference: string | undefined, targetReference: string | undefined, aliases: string[] = []): boolean {
  if (!currentReference || !targetReference) {
    return false;
  }

  return new Set([targetReference, ...aliases]).has(currentReference);
}
