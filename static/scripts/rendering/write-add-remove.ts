import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { Manifest, Plugin } from "../../types/plugins";
import { parseConfigInputs } from "./input-parsing";
import { getOfficialPluginConfig } from "../../utils/storage";

export function writeNewConfig(renderer: ManifestRenderer, option: "add" | "remove"): void {
  const selectedManifest = localStorage.getItem("selectedPluginManifest");
  if (!selectedManifest) {
    toastNotification("No selected plugin manifest found.", {
      type: "error",
      shouldAutoDismiss: true,
    });
    throw new Error("No selected plugin manifest found");
  }
  const pluginManifest = JSON.parse(selectedManifest) as Manifest;
  const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

  const newConfig = parseConfigInputs(configInputs, pluginManifest);

  renderer.configParser.loadConfig();

  const officialPluginConfig: Record<string, { actionUrl?: string; workerUrl?: string }> = getOfficialPluginConfig();

  const pluginName = pluginManifest.name;

  // this relies on the manifest matching the repo name
  const normalizedPluginName = pluginName
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");

  const pluginUrl = Object.keys(officialPluginConfig).find((url) => {
    return url.includes(normalizedPluginName);
  });

  if (!pluginUrl) {
    toastNotification(`No plugin URL found for ${pluginName}.`, {
      type: "error",
      shouldAutoDismiss: true,
    });
    throw new Error("No plugin URL found");
  }

  const plugin: Plugin = {
    uses: [
      {
        plugin: pluginUrl,
        with: newConfig,
      },
    ],
  };

  if (option === "add") {
    handleAddPlugin(renderer, plugin, pluginManifest);
  } else {
    handleRemovePlugin(renderer, plugin, pluginManifest);
  }
}

function handleAddPlugin(renderer: ManifestRenderer, plugin: Plugin, pluginManifest: Manifest): void {
  renderer.configParser.addPlugin(plugin);
  toastNotification(`Configuration for ${pluginManifest.name} saved successfully.Do you want to push to GitHub ? `, {
    type: "success",
    actionText: "Push to GitHub",
    action: async () => {
      const octokit = renderer.auth.octokit;
      if (!octokit) {
        throw new Error("Octokit not found");
      }

      const org = localStorage.getItem("selectedOrg");

      if (!org) {
        throw new Error("No selected org found");
      }

      try {
        await renderer.configParser.updateConfig(org, octokit, "add");
      } catch (error) {
        console.error("Error pushing config to GitHub:", error);
        toastNotification("An error occurred while pushing the configuration to GitHub.", {
          type: "error",
          shouldAutoDismiss: true,
        });
        return;
      }

      toastNotification("Configuration pushed to GitHub successfully.", {
        type: "success",
        shouldAutoDismiss: true,
      });
    },
  });
}

function handleRemovePlugin(renderer: ManifestRenderer, plugin: Plugin, pluginManifest: Manifest): void {
  renderer.configParser.removePlugin(plugin);
  toastNotification(`Configuration for ${pluginManifest.name} removed successfully.Do you want to push to GitHub ? `, {
    type: "success",
    actionText: "Push to GitHub",
    action: async () => {
      const octokit = renderer.auth.octokit;
      if (!octokit) {
        throw new Error("Octokit not found");
      }

      const org = localStorage.getItem("selectedOrg");

      if (!org) {
        throw new Error("No selected org found");
      }

      try {
        await renderer.configParser.updateConfig(org, octokit, "remove");
      } catch (error) {
        console.error("Error pushing config to GitHub:", error);
        toastNotification("An error occurred while pushing the configuration to GitHub.", {
          type: "error",
          shouldAutoDismiss: true,
        });
        return;
      }

      toastNotification("Configuration pushed to GitHub successfully.", {
        type: "success",
        shouldAutoDismiss: true,
      });
    },
  });
}
