import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";
import { STRINGS } from "../../utils/strings";
import { Manifest, ManifestCache, ManifestPreDecode, Plugin, PluginConfig } from "../../types/plugins";
import { AnySchemaObject } from "ajv";
import { createInputRow } from "../../utils/element-helpers";
import { controlButtons } from "../rendering/control-buttons";
import { updateGuiTitle } from "../rendering/utils";
import { parseConfigInputs } from "../rendering/input-parsing";
import YAML from "yaml";
import { AuthService } from "../authentication";

type TemplateTypes = "minimal" | "full-defaults" | "custom";
type MinimalPredefinedConfig = {
  "text-conversation-rewards": {
    yamlConfig: string;
  };
  "command-start-stop": {
    yamlConfig: string;
  };
  "daemon-pricing": {
    yamlConfig: string;
  };
};

declare const MINIMAL_PREDEFINED_CONFIG: string;

export async function configTemplateHandler(type: TemplateTypes, renderer: ManifestRenderer) {
  let config: string | undefined;
  if (type === "minimal") {
    config = await handleMinimalTemplate();
  } else if (type === "full-defaults") {
    await handleFullDefaultsTemplate(renderer);
    return;
  } else {
    throw new Error("Invalid template type");
  }

  if (!config) {
    throw new Error(STRINGS.FAILED_TO_LOAD_TEMPLATE);
  }

  const org = localStorage.getItem("selectedOrg");

  if (!org) {
    throw new Error("No selected org found");
  }

  const octokit = renderer.auth.octokit;
  if (!octokit) {
    throw new Error("Octokit not found");
  }

  const userInstalledConfig = await renderer.configParser.fetchUserInstalledConfig(org, octokit);

  try {
    // YAML.stringify({ plugins: [] }).length === 12
    if (userInstalledConfig.length > 12) {
      toastNotification("Configuration File Detected: This will be overwritten, are you sure you want to continue?", {
        type: "warning",
        actionText: "Continue",
        action: async () => {
          await writeTemplate(renderer, config, type, octokit, org);
        },
      });
      return;
    }
    await writeTemplate(renderer, config, type, octokit, org);
  } catch (error) {
    toastNotification(STRINGS.FAILED_TO_LOAD_TEMPLATE, { type: "error" });
    throw error;
  }
}

async function writeTemplate(renderer: ManifestRenderer, config: string, type: TemplateTypes, octokit: AuthService["octokit"], org: string) {
  try {
    renderer.configParser.saveConfig(config);
    toastNotification(`Successfully loaded ${type} template. Do you want to push to GitHub? `, {
      type: "success",
      actionText: "Push to GitHub",
      action: async () => {
        try {
          await renderer.configParser.createOrUpdateFileContents(org, CONFIG_ORG_REPO, CONFIG_FULL_PATH, octokit);
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
  } catch (error) {
    toastNotification(STRINGS.FAILED_TO_LOAD_TEMPLATE, { type: "error" });
    throw error;
  }
}

async function handleMinimalTemplate(): Promise<string> {
  try {
    const obj = JSON.parse(MINIMAL_PREDEFINED_CONFIG) as MinimalPredefinedConfig;

    const parts = Array.from(Object.entries(obj)).map(([, value]) => {
      return `\n  ${value.yamlConfig}`;
    });

    return `plugins:${parts.join("")}`;
  } catch (error) {
    toastNotification("Failed to fetch minimal predefined config", { type: "error" });
    throw error;
  }
}

async function handleFullDefaultsTemplate(renderer: ManifestRenderer) {
  renderer.configParser.writeBlankConfig();

  const manifestCache = JSON.parse(localStorage.getItem("manifestCache") || "{}") as ManifestCache;
  const pluginUrls = Object.keys(manifestCache);
  const cleanManifestCache = Object.keys(manifestCache).reduce((acc, key) => {
    if (manifestCache[key]?.name) {
      acc[key] = manifestCache[key];
    }
    return acc;
  }, {} as ManifestCache);

  const plugins: { name: string; defaults: ManifestPreDecode["configuration"] }[] = [];

  pluginUrls.forEach((url) => {
    if (!cleanManifestCache[url]?.name) {
      return;
    }

    const defaultForInstalled: ManifestPreDecode | null = cleanManifestCache[url];
    const manifestCache = JSON.parse(localStorage.getItem("manifestCache") || "{}") as ManifestCache;
    const pluginUrls = Object.keys(manifestCache);
    const pluginUrl = pluginUrls.find((url) => {
      return manifestCache[url].name === defaultForInstalled.name;
    });

    const plugin = manifestCache[pluginUrl || ""];
    const config = plugin?.configuration;

    if (!config) {
      return;
    }

    const defaults = buildDefaultValues<ManifestPreDecode["configuration"]>(config);

    plugins.push({
      name: plugin.name,
      defaults,
    });
  });

  renderRequiredFields(renderer, plugins).catch((error) => {
    console.error("Error rendering required fields:", error);
    toastNotification("An error occurred while rendering the required fields.", {
      type: "error",
      shouldAutoDismiss: true,
    });
  });
}

/**
 * undefined === not a required field, can be omitted
 * null === required field, but no default value
 *
 * for each null value, we need to render an input for that field
 * referencing the plugin name. Expect there to be lots but in reality
 * there are only a few.
 *
 */

async function renderRequiredFields(renderer: ManifestRenderer, plugins: { name: string; defaults: ManifestPreDecode["configuration"] }[]) {
  const configDefaults: Record<string, { type: string; value: unknown; items: { type: string } | null }> = {};
  renderer.manifestGuiBody.innerHTML = null;

  plugins.forEach((plugin) => {
    const { defaults } = plugin;
    const keys = Object.keys(defaults);
    keys.forEach((key) => {
      if (defaults[key as keyof typeof defaults] === null) {
        createInputRow(key, defaults, configDefaults);
      }
    });
  });

  updateGuiTitle("Fill in required fields");
  controlButtons({ hide: false });

  const resetToDefaultButton = document.getElementById("reset-to-default") as HTMLButtonElement;
  if (!resetToDefaultButton) {
    throw new Error("Reset to default button not found");
  }

  resetToDefaultButton.addEventListener("click", () => {
    renderRequiredFields(renderer, plugins).catch((error) => {
      console.error("Error rendering required fields:", error);
      toastNotification("An error occurred while rendering the required fields.", {
        type: "error",
        shouldAutoDismiss: true,
      });
    });
  });

  const add = document.getElementById("add") as HTMLButtonElement;
  const remove = document.getElementById("remove") as HTMLButtonElement;
  if (!add || !remove) {
    throw new Error("Add or remove button not found");
  }
  remove.remove();

  add.addEventListener("click", () => {
    const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");
    const newConfig = parseConfigInputs(configInputs, {} as Manifest, plugins);

    const officialPluginConfig: Record<string, { actionUrl?: string; workerUrl?: string }> = JSON.parse(localStorage.getItem("officialPluginConfig") || "{}");

    const pluginArr: Plugin[] = [];
    for (const [name, config] of Object.entries(newConfig)) {
      // this relies on the manifest matching the repo name
      const normalizedPluginName = name
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-");

      const pluginUrl = Object.keys(officialPluginConfig).find((url) => {
        return url.includes(normalizedPluginName);
      });

      if (!pluginUrl) {
        toastNotification(`No plugin URL found for ${normalizedPluginName}.`, {
          type: "error",
          shouldAutoDismiss: true,
        });

        return;
      }

      const plugin: Plugin = {
        uses: [
          {
            plugin: pluginUrl,
            with: config as Record<string, unknown>,
          },
        ],
      };

      pluginArr.push(plugin);
    }

    const pluginConfig: PluginConfig = {
      plugins: pluginArr,
    };

    const org = localStorage.getItem("selectedOrg");
    if (!org) {
      throw new Error("No selected org found");
    }

    writeTemplate(renderer, YAML.stringify(pluginConfig), "full-defaults", renderer.auth.octokit, localStorage.getItem("selectedOrg") || "").catch((error) => {
      console.error("Error writing template:", error);
      toastNotification("An error occurred while writing the template.", {
        type: "error",
        shouldAutoDismiss: true,
      });
    });
  });
}

function buildDefaultValues<T>(schema: AnySchemaObject): T {
  const defaults: Partial<T> = {};
  const requiredProps = schema.required || [];

  for (const key of Object.keys(schema.properties)) {
    if (Reflect.has(schema.properties, key)) {
      const hasDefault = "default" in schema.properties[key];
      const value = schema.properties[key].default;

      const _key = key as keyof T;

      if (hasDefault && value) {
        defaults[_key] = value;
      } else if (requiredProps.includes(_key)) {
        defaults[_key] = null as unknown as T[keyof T];
      } else {
        defaults[_key] = undefined;
      }
    }
  }

  return defaults as T;
}
