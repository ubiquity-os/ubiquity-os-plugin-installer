import YAML from "yaml";
import { Plugin, PluginConfig } from "../types/plugins";
import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import { toastNotification } from "../utils/toaster";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";

/**
 * Responsible for fetching, parsing, and updating the user's installed plugin configurations.
 *
 * - `configRepoExistenceCheck` checks if the user has a config repo and creates one if not
 * - `repoFileExistenceCheck` checks if the user has a config file and creates one if not
 * - `fetchUserInstalledConfig` fetches the user's installed config from the config repo
 */
export class ConfigParser {
  repoConfig: string | null = null;
  repoConfigSha: string | null = null;
  newConfigYml: string | null = null;

  async configRepoExistenceCheck(org: string, repo: string, octokit: Octokit) {
    if (!org || !repo) {
      throw new Error("Organization or repo name not provided");
    }

    let exists;

    try {
      await octokit.repos.get({
        owner: org,
        repo,
      });
      exists = true;
    } catch (error) {
      console.log(error);
      exists = false;
    }

    if (!exists) {
      try {
        await octokit.repos.createInOrg({
          name: repo,
          description: "UbiquityOS Configuration Repo",
          org,
        });

        toastNotification("We noticed you don't have a '.ubiquity-os' config repo, so we created one for you.", { type: "success" });
      } catch (er) {
        console.log(er);
        throw new Error("Config repo creation failed");
      }
    }

    return exists;
  }

  async repoFileExistenceCheck(org: string, octokit: Octokit, repo: string, path: string) {
    try {
      const { data } = await octokit.repos.getContent({
        owner: org,
        repo,
        path,
      });

      return data;
    } catch (error) {
      console.error(error);
    }

    return null;
  }

  async fetchUserInstalledConfig(org: string, octokit: Octokit, repo = CONFIG_ORG_REPO, path = CONFIG_FULL_PATH) {
    if (repo === CONFIG_ORG_REPO) {
      await this.configRepoExistenceCheck(org, repo, octokit);
    }

    let existingConfig = await this.repoFileExistenceCheck(org, octokit, repo, path);

    if (!existingConfig) {
      try {
        this.newConfigYml = YAML.stringify({ plugins: [] });
        await octokit.repos.createOrUpdateFileContents({
          owner: org,
          repo,
          path,
          message: `chore: creating config`,
          content: btoa(this.newConfigYml),
        });

        toastNotification(`We couldn't locate your config file, so we created an empty one for you.`, { type: "success" });

        existingConfig = await this.repoFileExistenceCheck(org, octokit, repo, path);
      } catch (er) {
        console.log(er);
        throw new Error("Config file creation failed");
      }
    }

    if (existingConfig && "content" in existingConfig) {
      this.repoConfigSha = existingConfig.sha;
      this.repoConfig = atob(existingConfig.content);
    } else {
      throw new Error("No existing config found");
    }

    return this.repoConfig;
  }

  parseConfig(config?: string | null): PluginConfig {
    if (config && typeof config === "string") {
      return YAML.parse(config);
    } else {
      return YAML.parse(this.loadConfig());
    }
  }

  async updateConfig(org: string, octokit: Octokit, repo = CONFIG_ORG_REPO, path = CONFIG_FULL_PATH) {
    return this.createOrUpdateFileContents(org, repo, path, octokit);
  }

  async createOrUpdateFileContents(org: string, repo: string, path: string, octokit: Octokit) {
    const recentSha = await octokit.repos.getContent({
      owner: org,
      repo: repo,
      path,
    });

    const sha = "sha" in recentSha.data ? recentSha.data.sha : null;

    if (!sha) {
      throw new Error("No sha found");
    }

    if (!this.newConfigYml) {
      throw new Error("No content to push");
    }

    this.repoConfig = this.newConfigYml;

    return octokit.repos.createOrUpdateFileContents({
      owner: org,
      repo: repo,
      path,
      message: `chore: Plugin Installer UI - update`,
      content: btoa(this.newConfigYml),
      sha,
    });
  }

  addPlugin(plugin: Plugin) {
    const parsedConfig = this.parseConfig(this.repoConfig);
    parsedConfig.plugins ??= [];

    const existingPlugin = parsedConfig.plugins.find((p) => p.uses[0].plugin === plugin.uses[0].plugin);
    if (existingPlugin) {
      existingPlugin.uses[0].with = plugin.uses[0].with;
    } else {
      parsedConfig.plugins.push(plugin);
    }

    this.newConfigYml = YAML.stringify(parsedConfig);
    this.repoConfig = this.newConfigYml;
    this.saveConfig();
  }

  removePlugin(plugin: Plugin) {
    const parsedConfig = this.parseConfig(this.repoConfig);
    if (!parsedConfig.plugins) {
      toastNotification("No plugins found in config", { type: "error" });
      return;
    }

    parsedConfig.plugins = parsedConfig.plugins.filter((p: Plugin) => p.uses[0].plugin !== plugin.uses[0].plugin);
    this.newConfigYml = YAML.stringify(parsedConfig);
    this.repoConfig = this.newConfigYml;
    this.saveConfig();
  }

  loadConfig(): string {
    if (!this.newConfigYml) {
      this.newConfigYml = localStorage.getItem("config") as string;
    }

    if (!this.newConfigYml) {
      this.writeBlankConfig();
    }

    if (!this.repoConfig && this.newConfigYml) {
      this.repoConfig = YAML.parse(this.newConfigYml);
    }

    return this.newConfigYml;
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
