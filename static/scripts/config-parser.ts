import YAML from "yaml";
import { Plugin, PluginConfig } from "../types/plugins";
import { Octokit } from "@octokit/rest";
import { toastNotification } from "../utils/toaster";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";

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

  async repoFileExistenceCheck(org: string, env: "development" | "production", octokit: Octokit, repo: string, path: string) {
    try {
      const { data } = await octokit.repos.getContent({
        owner: org,
        repo,
        path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
      });

      return data;
    } catch (error) {
      console.error(error);
    }

    return null;
  }

  async fetchUserInstalledConfig(org: string, env: "development" | "production", octokit: Octokit, repo = CONFIG_ORG_REPO, path = CONFIG_FULL_PATH) {
    if (repo === CONFIG_ORG_REPO) {
      await this.configRepoExistenceCheck(org, repo, octokit);
    }

    let existingConfig = await this.repoFileExistenceCheck(org, env, octokit, repo, path);

    if (!existingConfig) {
      try {
        this.newConfigYml = YAML.stringify({ plugins: [] });
        await octokit.repos.createOrUpdateFileContents({
          owner: org,
          repo,
          path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
          message: `chore: creating ${env} config`,
          content: btoa(this.newConfigYml),
        });

        toastNotification(`We couldn't locate your ${env} config file, so we created an empty one for you.`, { type: "success" });

        existingConfig = await this.repoFileExistenceCheck(org, env, octokit, repo, path);
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
    if (config) {
      return YAML.parse(config);
    }
    if (!this.newConfigYml) {
      this.loadConfig();
    }
    return YAML.parse(`${this.newConfigYml}`);
  }

  async updateConfig(
    org: string,
    env: "development" | "production",
    octokit: Octokit,
    option: "add" | "remove",
    path = CONFIG_FULL_PATH,
    repo = CONFIG_ORG_REPO
  ) {
    let repoPlugins = this.parseConfig(this.repoConfig).plugins;
    const newPlugins = this.parseConfig().plugins;

    if (!newPlugins?.length && option === "add") {
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
    return this.createOrUpdateFileContents(org, repo, path, env, octokit);
  }

  async createOrUpdateFileContents(org: string, repo: string, path: string, env: "development" | "production", octokit: Octokit) {
    const recentSha = await octokit.repos.getContent({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
    });

    const sha = "sha" in recentSha.data ? recentSha.data.sha : null;

    if (!sha) {
      throw new Error("No sha found");
    }

    if (!this.newConfigYml) {
      throw new Error("No content to push");
    }

    return octokit.repos.createOrUpdateFileContents({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
      message: `chore: updating ${env} config`,
      content: btoa(this.newConfigYml),
      sha,
    });
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
    this.newConfigYml = YAML.stringify(parsedConfig);
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
}
