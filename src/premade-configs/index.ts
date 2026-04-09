/**
 * Premade Configurations Loader
 * 
 * Provides functionality to load, validate, and access pre-built plugin configurations.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import Ajv from "ajv";
import type { PremadeConfig } from "./schema.js";
import { premadeConfigSchema } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Available premade config files */
export const PREMADE_CONFIG_FILES = [
  "standard.yml",
  "minimal.yml",
  "code-review.yml",
] as const;

export type PremadeConfigFile = typeof PREMADE_CONFIG_FILES[number];

/** AJV instance for validation */
const ajv = new Ajv({
  strict: true,
  allErrors: true,
});

/**
 * Loads a premade configuration file by name
 * @param configName - Name of the config file (without .yml extension)
 * @returns The parsed and validated premade configuration
 * @throws Error if config file not found or validation fails
 */
export function loadPremadeConfig(configName: string): PremadeConfig {
  const configPath = join(__dirname, `${configName}.yml`);
  
  try {
    const fileContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(fileContent) as PremadeConfig;
    
    // Validate the config
    const validate = ajv.compile(premadeConfigSchema);
    const valid = validate(config);
    
    if (!valid) {
      const errors = validate.errors?.map((e) => `${e.instancePath}: ${e.message}`).join(", ") || "Unknown validation error";
      throw new Error(`Invalid premade config "${configName}": ${errors}`);
    }
    
    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw new Error(`Premade config "${configName}" not found`);
    }
    throw error;
  }
}

/**
 * Loads all available premade configurations
 * @returns Array of all premade configurations
 */
export function loadAllPremadeConfigs(): PremadeConfig[] {
  const configs: PremadeConfig[] = [];
  
  for (const file of PREMADE_CONFIG_FILES) {
    const configName = file.replace(".yml", "");
    try {
      const config = loadPremadeConfig(configName);
      configs.push(config);
    } catch (error) {
      console.error(`Failed to load premade config "${configName}":`, error);
    }
  }
  
  return configs;
}

/**
 * Gets a premade configuration by its ID
 * @param id - The configuration ID (e.g., 'standard', 'minimal', 'code-review')
 * @returns The premade configuration or undefined if not found
 */
export function getPremadeConfigById(id: string): PremadeConfig | undefined {
  const configs = loadAllPremadeConfigs();
  return configs.find((config) => config.id === id);
}

/**
 * Gets all premade configurations grouped by category
 * @returns Object with categories as keys and arrays of configs as values
 */
export function getPremadeConfigsByCategory(): Record<string, PremadeConfig[]> {
  const configs = loadAllPremadeConfigs();
  const grouped: Record<string, PremadeConfig[]> = {};
  
  for (const config of configs) {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }
    grouped[config.category].push(config);
  }
  
  return grouped;
}

/**
 * Converts a premade configuration to the plugin config format used by UbiquityOS
 * @param premadeConfig - The premade configuration to convert
 * @returns Plugin config object ready for YAML serialization
 */
export function convertToPluginConfig(premadeConfig: PremadeConfig): { plugins: Array<{ uses: Array<{ plugin: string; with?: Record<string, unknown>; skipBotEvents?: boolean }> }> } {
  const plugins = premadeConfig.plugins.map((p) => ({
    uses: [
      {
        plugin: `${p.plugin}@${p.version}`,
        ...(p.skipBotEvents !== undefined && { skipBotEvents: p.skipBotEvents }),
        ...(p.with && { with: p.with }),
      },
    ],
  }));
  
  return { plugins };
}

/**
 * Gets the list of all available premade config file names
 * @returns Array of config file names
 */
export function getAvailablePremadeConfigs(): string[] {
  return PREMADE_CONFIG_FILES.map((f) => f.replace(".yml", ""));
}

export default {
  loadPremadeConfig,
  loadAllPremadeConfigs,
  getPremadeConfigById,
  getPremadeConfigsByCategory,
  convertToPluginConfig,
  getAvailablePremadeConfigs,
  PREMADE_CONFIG_FILES,
};