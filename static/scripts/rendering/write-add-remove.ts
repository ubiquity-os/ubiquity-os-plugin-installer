import { ManifestPreDecode, Plugin } from "../../types/plugins";
import { ManifestRenderer } from "../render-manifest";
import { handleBackButtonClick } from "./navigation";
import { renderPluginSelector } from "./plugin-select";

export function writeNewConfig(renderer: ManifestRenderer, pluginManifest: ManifestPreDecode, config: Record<string, string>) {
  renderer.configParser.loadConfig();

  const pluginName = pluginManifest.repoName || pluginManifest.name;

  const plugin: Plugin = {
    uses: [
      {
        plugin: pluginName,
        with: config,
      },
    ],
  };

  renderer.configParser.addPlugin(plugin);
  handleBackButtonClick(renderer);
  renderPluginSelector(renderer);
}

export function handleResetToDefault(renderer: ManifestRenderer, pluginManifest?: ManifestPreDecode) {
  if (!pluginManifest) {
    renderPluginSelector(renderer);
    return;
  }

  const configurationDefault = pluginManifest.configuration.default as Record<string, string>;
  writeNewConfig(renderer, pluginManifest, configurationDefault);
}
