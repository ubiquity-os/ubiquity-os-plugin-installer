import YAML from "yaml";
import { Plugin, PluginConfig } from "../types/plugins";
import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import { toastNotification } from "../utils/toaster";

const CONFIG_PATH = ".github/.ubiquity-os.config.yml";
const UBIQUITY_OS = ".ubiquity-os";

export class ConfigParser {
  repoConfig: string | null = null;
  repoConfigSha: string | null = null;
  newConfigYml: string | null = null;

  async fetchUserInstalledConfig(org: string | null, repo: string | null, env: "development" | "production", octokit: Octokit | null) {
    if (!org || !octokit) {
      throw new Error("Missing required parameters");
    }

    const content = this.loadConfig();
    if (!content) {
      throw new Error("No content to push");
    }

    try {
      const existingConfig = await octokit.repos.getContent({
        owner: org,
        repo: repo ? repo : UBIQUITY_OS,
        path: env === "production" ? CONFIG_PATH : CONFIG_PATH.replace(".yml", ".dev.yml"),
        ref: repo ? "development" : "main",
      });

      if (existingConfig && "content" in existingConfig.data) {
        this.repoConfigSha = existingConfig.data.sha;
        this.repoConfig = atob(existingConfig.data.content);
      }
    } catch (er) {
      console.log(er);
      if (er instanceof RequestError && er.status === 404) {
        const msgParts = ["Could not find the", env, "config file in", repo ? repo : `your org: ${org}`, ", would you like to create one?"];

        toastNotification(msgParts.join(" "), {
          type: "success",
          actionText: "Create",
          action: async () => {
            await this.handleMissingStorageBranchOrFile(octokit, org, repo);
          },
        });
      }
    }
  }

  parseConfig(config?: string | null): PluginConfig {
    if (config && typeof config === "string") {
      return YAML.parse(config);
    } else {
      return YAML.parse(this.loadConfig());
    }
  }

  async updateConfig(org: string, repo: string | null, env: "development" | "production", octokit: Octokit, option: "add" | "remove") {
    let repoPlugins = this.parseConfig(this.repoConfig).plugins;
    const newPlugins = this.parseConfig().plugins;

    if (!newPlugins) {
      throw new Error("No plugins found in the config");
    }

    const newPluginNames = newPlugins.map((p) => p.uses[0].plugin);
    if (newPluginNames.length === 0) {
      throw new Error("No plugins found in the config");
    }

    if (option === "add") {
      // update if it exists, add if it doesn't
      newPlugins.forEach((newPlugin) => {
        const existingPlugin = repoPlugins.find((p) => p.uses[0].plugin === newPlugin.uses[0].plugin);
        if (existingPlugin) {
          existingPlugin.uses[0].with = newPlugin.uses[0].with;
        } else {
          repoPlugins.push(newPlugin);
        }
      });

      this.newConfigYml = YAML.stringify({ plugins: repoPlugins });
    } else if (option === "remove") {
      // remove only this plugin, keep all others
      newPlugins.forEach((newPlugin) => {
        const existingPlugin = repoPlugins.find((p) => p.uses[0].plugin === newPlugin.uses[0].plugin);
        if (existingPlugin) {
          repoPlugins = repoPlugins.filter((p) => p.uses[0].plugin !== newPlugin.uses[0].plugin);
        }
      });
      this.newConfigYml = YAML.stringify({ plugins: newPlugins });
    }

    this.saveConfig();
    return this.createOrUpdateFileContents(org, repo, env, octokit);
  }

  async createOrUpdateFileContents(org: string, repo: string | null, env: "development" | "production", octokit: Octokit) {
    const recentSha = await octokit.repos.getContent({
      owner: org,
      repo: repo ? repo : UBIQUITY_OS,
      path: env === "production" ? CONFIG_PATH : CONFIG_PATH.replace(".yml", ".dev.yml"),
      ref: repo ? "development" : "main",
    });

    const sha = "sha" in recentSha.data ? recentSha.data.sha : null;

    try {
      return octokit.repos.createOrUpdateFileContents({
        owner: org,
        repo: repo ? repo : UBIQUITY_OS,
        path: env === "production" ? CONFIG_PATH : CONFIG_PATH.replace(".yml", ".dev.yml"),
        message: `chore: updating ${env} config`,
        content: btoa(`${this.newConfigYml}`),
        sha: `${sha}`,
        branch: repo ? "development" : "main",
      });
    } catch (err) {
      throw new Error(`Failed to create or update file contents:\n ${String(err)}`);
    }
  }

  addPlugin(plugin: Plugin) {
    const config = this.loadConfig();
    const parsedConfig = YAML.parse(config);
    if (!parsedConfig.plugins) {
      parsedConfig.plugins = [];
    }
    parsedConfig.plugins.push(plugin);
    this.newConfigYml = YAML.stringify(parsedConfig);
    this.saveConfig();
  }

  removePlugin(plugin: Plugin) {
    const config = this.loadConfig();
    const parsedConfig = YAML.parse(config);
    if (!parsedConfig.plugins) {
      console.log("No plugins to remove");
      return;
    }
    parsedConfig.plugins = parsedConfig.plugins.filter((p: Plugin) => p.uses[0].plugin !== plugin.uses[0].plugin);
    console.log(parsedConfig);
    this.newConfigYml = YAML.stringify(parsedConfig);
    this.saveConfig();
  }

  /**
   * Loads the current config from local storage or
   * creates a new one if it doesn't exist.
   *
   * If a new config is created, it is also saved to local storage.
   * When a new config is created, it is a blank JS object representing
   * the ubiquity-os.config.yml file.
   */
  loadConfig() {
    if (!this.newConfigYml) {
      this.newConfigYml = localStorage.getItem("config");
    }

    if (!this.newConfigYml) {
      this.writeBlankConfig();
    }

    if (!this.repoConfig && this.newConfigYml) {
      this.repoConfig = YAML.parse(this.newConfigYml);
    }

    return this.newConfigYml as string;
  }

  saveConfig() {
    if (this.newConfigYml) {
      localStorage.setItem("config", this.newConfigYml);
    }
  }

  writeBlankConfig() {
    this.newConfigYml = YAML.stringify({ plugins: [] });
    this.saveConfig();
  }

  async handleMissingStorageBranchOrFile(octokit: Octokit, owner: string, repo: string | null) {
    let mostRecentDefaultHeadCommitSha;

    try {
      const { data: defaultBranchData } = await octokit.rest.repos.getCommit({
        owner,
        repo: repo ? repo : UBIQUITY_OS,
        ref: repo ? "development" : "main",
      });
      mostRecentDefaultHeadCommitSha = defaultBranchData.sha;
    } catch (er) {
      throw new Error(`Failed to get default branch commit sha:\n ${String(er)}`);
    }

    // Check if the branch exists
    try {
      await octokit.rest.repos.getBranch({
        owner,
        repo: repo ? repo : UBIQUITY_OS,
        branch: repo ? "development" : "main",
      });
    } catch (branchError) {
      if (branchError instanceof RequestError || branchError instanceof Error) {
        const { message } = branchError;
        if (message.toLowerCase().includes(`branch not found`)) {
          // Branch doesn't exist, create the branch
          try {
            await octokit.rest.git.createRef({
              owner,
              repo: repo ? repo : UBIQUITY_OS,
              ref: `refs/heads/${repo ? "development" : "main"}`,
              sha: mostRecentDefaultHeadCommitSha,
            });
          } catch (err) {
            throw new Error(`Failed to create branch:\n ${String(err)}`);
          }
        } else {
          throw new Error(`Failed to handle missing storage branch or file:\n ${String(branchError)}`);
        }
      } else {
        throw new Error(`Failed to handle missing storage branch or file:\n ${String(branchError)}`);
      }
    }

    try {
      // Create or update the file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: repo ? repo : UBIQUITY_OS,
        path: CONFIG_PATH,
        branch: repo ? "development" : "main",
        message: `chore: create ${CONFIG_PATH.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        content: btoa("{\n}"),
        sha: mostRecentDefaultHeadCommitSha,
      });
    } catch (err) {
      throw new Error(`Failed to create new config file:\n ${String(err)}`);
    }

    const config = localStorage.getItem("selectedConfig");

    const msgParts = ["Created an empty", config, "config in", repo ? repo : `your org: ${owner}`];

    toastNotification(msgParts.join(" "), {
      type: "success",
      actionText: "Continue",
    });
  }
}
