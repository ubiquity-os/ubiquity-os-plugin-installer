import YAML from "yaml";
import { Plugin, PluginConfig, Uses, With } from "../types/plugins";
import { Octokit } from "@octokit/rest";

export class ConfigParser {
  currentConfig: string | null = null;
  newConfig: string | null = null;

  async pushConfigToRepo(org: string, env: "development" | "production", octokit: Octokit) {
    const repo = ".ubiquity-os";
    const path = `.github/.ubiquity-os.config.yml`;
    const content = this.currentConfig;
    if (!content) {
      throw new Error("No content to push");
    }

    const existingConfig = await octokit.repos.getContent({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
    });

    let extContent, extSha;

    if (existingConfig && "content" in existingConfig.data) {
      extContent = atob(existingConfig.data.content);
      extSha = existingConfig.data.sha;
    }

    if (existingConfig) {
      return this.updateConfig(org, repo, path, env, content, octokit, {
        extContent,
        extSha,
      });
    } else {
      return this.createConfig(org, repo, path, env, content, octokit);
    }
  }

  async updateConfig(
    org: string,
    repo: string,
    path: string,
    env: "development" | "production",
    content: string,
    octokit: Octokit,
    existingConfig: { extContent?: string; extSha?: string }
  ) {
    const newContent = existingConfig ? `${existingConfig.extContent}\n${content}` : content;
    return octokit.repos.createOrUpdateFileContents({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
      message: `chore: updating ${env} config`,
      content: btoa(newContent),
      sha: existingConfig?.extSha,
    });
  }

  async createConfig(org: string, repo: string, path: string, env: "development" | "production", content: string, octokit: Octokit) {
    return octokit.repos.createOrUpdateFileContents({
      owner: org,
      repo: repo,
      path: env === "production" ? path : path.replace(".yml", ".dev.yml"),
      message: `chore: creating ${env} config`,
      content: btoa(content),
    });
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
    if (!this.currentConfig) {
      this.currentConfig = localStorage.getItem("config");
    }

    if (!this.currentConfig) {
      this.writeBlankConfig();
    }

    this.newConfig = this.currentConfig;

    return this.currentConfig;
  }

  saveConfig() {
    if (this.newConfig) {
      localStorage.setItem("config", this.newConfig);
      this.currentConfig = this.newConfig;
      this.newConfig = null;
    }
  }

  parseConfig(): PluginConfig {
    if (!this.currentConfig) {
      return { plugins: [] };
    }
    return YAML.parse(this.currentConfig) as PluginConfig;
  }

  writeBlankConfig() {
    this.newConfig = YAML.stringify({ plugins: [] });
    this.saveConfig();
  }

  addPlugin(plugin: Plugin) {
    this.loadConfig();
    const config = this.parseConfig();
    if (!config.plugins.some((p) => p.uses[0].plugin === plugin.uses[0].plugin)) {
      config.plugins.push(plugin);
    }
    this.newConfig = YAML.stringify(config);
    this.saveConfig();
  }

  removePlugin(pluginName: string) {
    this.loadConfig();
    const config = this.parseConfig();
    config.plugins = config.plugins.filter((p) => p.uses[0].plugin !== pluginName);
    this.newConfig = YAML.stringify(config);
    this.saveConfig();
  }

  updatePlugin(plugin: Plugin) {
    this.loadConfig();
    const config = this.parseConfig();
    const index = config.plugins.findIndex((p) => p.uses[0].plugin === plugin.uses[0].plugin);
    if (index !== -1) {
      config.plugins[index] = plugin;
    } else {
      config.plugins.push(plugin);
    }
    this.newConfig = YAML.stringify(config);
    this.saveConfig();
  }

  extractPlugin(pluginName: string): Plugin | null {
    this.loadConfig();
    const config = this.parseConfig();
    return config.plugins.find((p) => p.uses.some((u) => u.plugin === pluginName)) || null;
  }

  extractUses(pluginName: string): Uses[] {
    const plugin = this.extractPlugin(pluginName);
    return plugin ? plugin.uses : [];
  }

  extractWith(pluginName: string): With[] {
    const uses = this.extractUses(pluginName);
    return uses.map((u) => u.with);
  }
}
