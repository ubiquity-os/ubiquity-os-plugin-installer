import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";

type PluginConfig = {
  plugins: Plugin[];
};

interface Plugin {
  uses: Uses[];
}

interface Uses {
  plugin: string;
  with: Record<string, unknown>;
}

interface ManifestPreDecode {
  manifest: Manifest;
  homepageUrl?: string | null;
  error?: string;
  readme?: string;
}

type ManifestCache = Record<string, ManifestPreDecode>;

export { ManifestCache, PluginConfig, Plugin, Uses, ManifestPreDecode, Manifest };
