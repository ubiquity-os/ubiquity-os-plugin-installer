import YAML from 'yaml';
import { Plugin, PluginConfig, Uses, With } from '../types/plugins';

export class ConfigParser {
  currentConfig: string | null = null;
  newConfig: string | null = null;

  loadConfig() {
    this.currentConfig = localStorage.getItem('config');
  }

  saveConfig() {
    if (this.newConfig) {
      localStorage.setItem('config', this.newConfig);
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
    if (!config.plugins.some(p => p.uses[0].plugin === plugin.uses[0].plugin)) {
      config.plugins.push(plugin);
    }
    this.newConfig = YAML.stringify(config);
    this.saveConfig();
  }

  removePlugin(pluginName: string) {
    this.loadConfig();
    const config = this.parseConfig();
    config.plugins = config.plugins.filter(
      p => p.uses[0].plugin !== pluginName
    );
    this.newConfig = YAML.stringify(config);
    this.saveConfig();
  }

  updatePlugin(plugin: Plugin) {
    this.loadConfig();
    const config = this.parseConfig();
    const index = config.plugins.findIndex(
      p => p.uses[0].plugin === plugin.uses[0].plugin
    );
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
    return (
      config.plugins.find(p =>
        p.uses.some(u => u.plugin === pluginName)
      ) || null
    );
  }

  extractUses(pluginName: string): Uses[] {
    const plugin = this.extractPlugin(pluginName);
    return plugin ? plugin.uses : [];
  }

  extractWith(pluginName: string): With[] {
    const uses = this.extractUses(pluginName);
    return uses.map(u => u.with);
  }
}