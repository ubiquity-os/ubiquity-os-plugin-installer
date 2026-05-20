export type PremadeConfigDefinition = {
  id: string;
  name: string;
  description: string;
  pluginKeys: string[];
};

type PredefinedPluginConfig = {
  yamlConfig?: string;
};

type PredefinedPluginCatalog = Record<string, PredefinedPluginConfig>;
type DefinedJson<T> = string | T;

declare const MINIMAL_PREDEFINED_CONFIG: DefinedJson<PredefinedPluginCatalog>;
declare const PREMADE_CONFIGS: DefinedJson<PremadeConfigDefinition[]>;

export function getPremadeConfigDefinitions(): PremadeConfigDefinition[] {
  return parsePremadeConfigDefinitions(PREMADE_CONFIGS);
}

export function buildPremadeConfigYamlById(premadeId: string): string {
  const premadeConfigs = parsePremadeConfigDefinitions(PREMADE_CONFIGS);
  const pluginCatalog = parsePredefinedPluginCatalog(MINIMAL_PREDEFINED_CONFIG);
  const premadeConfig = premadeConfigs.find((config) => config.id === premadeId);

  if (!premadeConfig) {
    throw new Error(`Unknown premade config: ${premadeId}`);
  }

  return buildPremadeConfigYaml(premadeConfig, pluginCatalog);
}

export function parsePremadeConfigDefinitions(raw: DefinedJson<PremadeConfigDefinition[]>): PremadeConfigDefinition[] {
  const configs = parseDefinedJson<PremadeConfigDefinition[]>(raw);

  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error("At least one premade config is required");
  }

  const ids = new Set<string>();
  for (const config of configs) {
    if (!config.id || !config.name || !config.description || !config.pluginKeys?.length) {
      throw new Error("Premade config definitions require id, name, description, and pluginKeys");
    }
    if (ids.has(config.id)) {
      throw new Error(`Duplicate premade config id: ${config.id}`);
    }
    ids.add(config.id);
  }

  return configs;
}

export function parsePredefinedPluginCatalog(raw: DefinedJson<PredefinedPluginCatalog>): PredefinedPluginCatalog {
  return parseDefinedJson<PredefinedPluginCatalog>(raw);
}

export function buildPremadeConfigYaml(config: PremadeConfigDefinition, pluginCatalog: PredefinedPluginCatalog): string {
  const pluginYaml = config.pluginKeys.map((pluginKey) => {
    const yamlConfig = pluginCatalog[pluginKey]?.yamlConfig;
    if (!yamlConfig) {
      throw new Error(`Missing predefined plugin config: ${pluginKey}`);
    }
    return `\n  ${yamlConfig}`;
  });

  return [
    `# ${config.name}`,
    `# ${config.description}`,
    "# This metadata is for the installer UI; UbiquityOS ignores YAML comments.",
    "plugins:",
    pluginYaml.join(""),
  ].join("\n");
}

function parseDefinedJson<T>(raw: DefinedJson<T>): T {
  return typeof raw === "string" ? (JSON.parse(raw) as T) : raw;
}
