import { describe, expect, it } from "@jest/globals";
import premadeConfigs from "../static/premade-configs.json";
import predefinedPlugins from "../static/minimal-predefined.json";
import { buildPremadeConfigYaml, parsePremadeConfigDefinitions, parsePredefinedPluginCatalog } from "../static/scripts/predefined-configs/premade-configs";

describe("premade configs", () => {
  it("builds partner-ready YAML with metadata comments and selected plugins", () => {
    const definitions = parsePremadeConfigDefinitions(
      JSON.stringify([
        {
          id: "lite",
          name: "UbiquityOS Lite",
          description: "Smallest hands-off setup.",
          pluginKeys: ["command-start-stop", "daemon-pricing"],
        },
      ])
    );

    const yaml = buildPremadeConfigYaml(definitions[0], {
      "command-start-stop": { yamlConfig: "- uses:\n    - plugin: command-start-stop" },
      "daemon-pricing": { yamlConfig: "- uses:\n    - plugin: daemon-pricing" },
    });

    expect(yaml).toContain("# UbiquityOS Lite");
    expect(yaml).toContain("plugins:");
    expect(yaml).toContain("plugin: command-start-stop");
    expect(yaml).toContain("plugin: daemon-pricing");
  });

  it("builds every committed premade config from the existing predefined plugin catalog", () => {
    const definitions = parsePremadeConfigDefinitions(premadeConfigs);
    const pluginCatalog = parsePredefinedPluginCatalog(predefinedPlugins);
    const ids = new Set(definitions.map((definition) => definition.id));

    expect(ids.size).toBe(definitions.length);

    for (const definition of definitions) {
      const yaml = buildPremadeConfigYaml(definition, pluginCatalog);

      expect(yaml).toContain(`# ${definition.name}`);
      expect(yaml).toContain(`# ${definition.description}`);
      for (const pluginKey of definition.pluginKeys) {
        const yamlConfig = pluginCatalog[pluginKey]?.yamlConfig;
        expect(yamlConfig).toBeTruthy();
        expect(yaml).toContain(yamlConfig);
      }
    }
  });

  it("fails when a premade config references a missing plugin", () => {
    const [definition] = parsePremadeConfigDefinitions(
      JSON.stringify([
        {
          id: "standard",
          name: "UbiquityOS Standard",
          description: "Default partner preset.",
          pluginKeys: ["missing-plugin"],
        },
      ])
    );

    expect(() => buildPremadeConfigYaml(definition, {})).toThrow("Missing predefined plugin config: missing-plugin");
  });

  it("rejects duplicate premade config ids", () => {
    expect(() =>
      parsePremadeConfigDefinitions([
        { id: "duplicate", name: "First", description: "First config.", pluginKeys: ["command-start-stop"] },
        { id: "duplicate", name: "Second", description: "Second config.", pluginKeys: ["daemon-pricing"] },
      ])
    ).toThrow("Duplicate premade config id: duplicate");
  });
});
