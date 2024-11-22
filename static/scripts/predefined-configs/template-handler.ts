import { Octokit } from "@octokit/rest";
import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";
import { STRINGS } from "../../utils/strings";

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
    config = await handleFullDefaultsTemplate();
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

async function writeTemplate(renderer: ManifestRenderer, config: string, type: TemplateTypes, octokit: Octokit, org: string) {
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

// requires more thought
async function handleFullDefaultsTemplate() {
  return "";
}
