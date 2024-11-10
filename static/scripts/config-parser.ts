import YAML from "yaml";
import { Plugin, PluginConfig } from "../types/plugins";
import { Octokit } from "@octokit/rest";
const repo = ".ubiquity-os";
const path = `.github/.ubiquity-os.config.yml`;

export class ConfigParser {
  repoConfig: string | null = null;
  repoConfigSha: string | null = null;
  newConfigYml: string | null = null;

  async fetchUserInstalledConfig(org: string, env: "development" | "production", octokit: Octokit) {
    const content = this.loadConfig();
    if (!content) {
      throw new Error("No content to push");
    }

    const existingConfig = await octokit.repos.getContent({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
    });

    if (existingConfig && "content" in existingConfig.data) {
      this.repoConfigSha = existingConfig.data.sha;
      this.repoConfig = atob(existingConfig.data.content);
    } else {
      throw new Error("No existing config found"); // todo create repo/dirs/files
    }
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

  async updateConfig(org: string, env: "development" | "production", octokit: Octokit) {
    const repoPlugins = this.parseConfig(this.repoConfig).plugins;
    const newPlugins = this.parseConfig().plugins;

    if (!newPlugins) {
      throw new Error("No plugins found in the config");
    }

    const newPluginNames = newPlugins.map((p) => p.uses[0].plugin);
    if (newPluginNames.length === 0) {
      throw new Error("No plugins found in the config");
    }

    for (const plugin of newPlugins) {
      const repoPlugin = repoPlugins.find((p) => p.uses[0].plugin === plugin.uses[0].plugin);
      if (repoPlugin) {
        repoPlugin.uses = plugin.uses;
      } else {
        repoPlugins.push(plugin);
      }
    }

    this.newConfigYml = YAML.stringify({ plugins: repoPlugins });
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

    return octokit.repos.createOrUpdateFileContents({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
      message: `chore: creating ${env} config`,
      content: btoa(`${this.newConfigYml}`),
      sha: `${sha}`,
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

  /**
   * Loads the current config from local storage or
   * creates a new one if it doesn't exist.
   *
   * If a new config is created, it is also saved to local storage.
   * When a new config is created, it is a blank JS object representing
   * the ubiquity-os.config.yml file.
   */
  loadConfig() {
    if (this.repoConfig) {
      return this.repoConfig;
    }

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
}
