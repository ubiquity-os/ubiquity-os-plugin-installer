import AJV, { AnySchemaObject } from "ajv";
import { createInputRow } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { Manifest } from "../../types/plugins";
const ajv = new AJV({ allErrors: true, coerceTypes: true, strict: true });

export function processProperties(
  renderer: ManifestRenderer,
  manifest: Manifest | null | undefined,
  props: Record<string, Manifest["configuration"]>,
  prefix: string | null = null
) {
  const required = manifest?.configuration?.required || [];

  Object.keys(props).forEach((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const prop = props[key];
    if (!prop) {
      return;
    }

    if (prop.type === "object" && prop.properties) {
      processProperties(renderer, manifest, prop.properties, fullKey);
    } else if ("anyOf" in prop && Array.isArray(prop.anyOf)) {
      if (prop.default) {
        createInputRow(fullKey, prop, renderer.configDefaults, required.includes(fullKey));
      } else {
        prop.anyOf?.forEach((subProp) => {
          processProperties(renderer, manifest, subProp.properties || {}, fullKey);
        });
      }
    } else {
      createInputRow(fullKey, prop, renderer.configDefaults);
    }
  });
}

export function parseConfigInputs(
  configInputs: NodeListOf<HTMLInputElement | HTMLTextAreaElement>,
  manifest: Manifest
): { config: Record<string, unknown>; missing: string[] } {
  const config: Record<string, unknown> = {};
  const schema = manifest.configuration;
  if (!schema) {
    throw new Error("No schema found in manifest");
  }
  const required = schema.required || [];
  const validate = ajv.compile(schema as AnySchemaObject);

  configInputs.forEach((input) => {
    const key = input.getAttribute("data-config-key");
    if (!key) {
      throw new Error("Input key is required");
    }

    const keys = key.split(".");

    let currentObj = config;
    for (let i = 0; i < keys.length - 1; i++) {
      const part = keys[i];
      if (!currentObj[part] || typeof currentObj[part] !== "object") {
        currentObj[part] = {};
      }
      currentObj = currentObj[part] as Record<string, unknown>;
    }

    let value: unknown;
    const expectedType = input.getAttribute("data-type");

    if (expectedType === "boolean") {
      value = (input as HTMLInputElement).checked;
    } else if (expectedType === "object" || expectedType === "array") {
      if (!input.value) {
        value = expectedType === "object" ? {} : [];
      } else
        try {
          value = JSON.parse((input as HTMLTextAreaElement).value);
        } catch (e) {
          console.error(e);
          throw new Error(`Invalid JSON input for ${expectedType} at key "${key}": ${input.value}`);
        }
    } else {
      value = (input as HTMLInputElement).value;
    }
    currentObj[keys[keys.length - 1]] = value;
  });

  if (validate(config)) {
    const missing = [];
    for (const key of required) {
      const isBoolean = schema.properties && schema.properties[key] && schema.properties[key].type === "boolean";
      if ((isBoolean && config[key] === false) || config[key] === true) {
        continue;
      }

      if (!config[key] || config[key] === "undefined" || config[key] === "null") {
        missing.push(key);
      }
    }
    return { config, missing };
  } else {
    throw new Error("Invalid configuration: " + JSON.stringify(validate.errors, null, 2));
  }
}
