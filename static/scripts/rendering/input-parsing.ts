import AJV, { AnySchemaObject } from "ajv";
import { createInputRow } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { Manifest } from "../../types/plugins";
import { createAnyOfToggle } from "./anyof-handling";
import { STRINGS } from "../../utils/strings";

// Without the raw Typebox Schema it was difficult to use Typebox which is why I've used AJV to validate the configuration.
const ajv = new AJV({ allErrors: true, coerceTypes: true, strict: true });

/**
 * This creates the input rows for the configuration editor for any given plugin.
 */
export function processProperties(
  renderer: ManifestRenderer,
  manifest: Manifest | null | undefined,
  props: Record<string, Manifest["configuration"]>,
  prefix: string | null = null,
  desc?: string,
  examples?: string[]
) {
  const required = manifest?.configuration?.required || [];
  Object.keys(props).forEach((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const prop = props[key];
    if (!prop) {
      console.log(`No property found for ${key}`);
      return;
    }

    /**
     * Depending on how the developer uses the `description` property when defining the schema
     * they may describe each property or the parent object. If the parent object has a description
     * and the property does not, we use the parent object's description.
     *
     * This is also the case for examples.
     */

    let parentDesc = prop.description || desc;
    let parentExamples = prop.examples || examples;

    if (!parentDesc && prop.properties?.length > 0 && prop.properties[0].description) {
      parentDesc = prop.properties[0].description;
    }

    if (!parentExamples && prop.properties?.length > 0 && prop.properties[0].examples) {
      parentExamples = prop.properties[0].examples;
    }

    /**
     * Non-null Union of Objects - (see kernel-telegram `Ai Config`):
     * - We create a toggle and textarea for the user to select the option and edit the item.
     *
     * Null/Non-null Union of Objects - (see text-conversation-rewards `incentives.content-evaluator/user-extractor, etc...`):
     * - We create an Enabled/Disabled toggle and textarea for the user
     *   to select the option and edit the item
     *
     * Non-object Union: (see command-start-stop `Assigned Issue Scope`)
     * - We create a toggle for the user to select the option.
     *
     * Objects - (see text-conversation-rewards `incentives.file, etc...`):
     * - We create an input for each property in the object. Typically, these are
     *   non-null properties because the object is nullable when the schema is defined.
     *
     * Arrays - (see command-start-stop `Roles with Review Authority`):
     * - We create a textarea for the user to input an array of items.
     *
     * Boolean - (see command-start-stop `Start Requires Wallet`):
     * - We create a checkbox for the user to enable/disable the property. (see command-start-stop `Start Requires Wallet`)
     *
     * Rest:
     * - We create an input for the property.
     */

    if (prop.type === "object" && prop.properties) {
      processProperties(renderer, manifest, prop.properties, fullKey, parentDesc, parentExamples);
    } else if ("anyOf" in prop && Array.isArray(prop.anyOf)) {
      createAnyOfToggle(fullKey, prop, renderer.configDefaults);
    } else {
      createInputRow(fullKey, prop, renderer.configDefaults, parentDesc, parentExamples, required.includes(key));
    }
  });
}

/**
 * This parse the inputs from the configuration editor and returns the configuration object.
 * It also returns an array of missing required fields if any.
 *
 * It should become a priority to establish API like usage of `null` and `undefined` in our schemas so it's
 * easier and less buggy when using the installer.
 */
export function parseConfigInputs(
  configInputs: NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLDivElement>,
  manifest: Manifest
): { config: Record<string, unknown>; missing: string[] } {
  const config: Record<string, unknown> = {};
  const { configuration } = manifest;

  if (!configuration) {
    throw new Error("No schema found in manifest");
  }
  const required = configuration.required || [];
  const validate = ajv.compile(configuration as AnySchemaObject);

  let tempConfig: Record<string, unknown> = {};

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

    const expectedType = input.getAttribute("data-type");
    processExpectedType(input, expectedType, key, keys, currentObj);
    tempConfig = { ...tempConfig, ...config };
  });

  if (validate(tempConfig)) {
    const missing = [];
    for (const key of required) {
      const isBoolean = configuration.properties && configuration.properties[key] && configuration.properties[key].type === "boolean";
      if ((isBoolean && config[key] === false) || config[key] === true) {
        continue;
      }

      if (!config[key] || config[key] === "undefined" || config[key] === "null") {
        missing.push(key);
      }
    }

    /**
     * We've ID'd the required fields that are missing, now we check if there are any fields
     * that have null | undefined values and remove them from the configuration object,
     * since the defaults will be used the config prop does not need to be present.
     */

    Object.keys(config).forEach((key) => {
      if (config[key] === null || config[key] === undefined || config[key] === "") {
        delete config[key];
      }
    });

    return { config, missing };
  } else {
    throw new Error("Invalid configuration: " + JSON.stringify(validate.errors, null, 2));
  }
}

function processExpectedType(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLDivElement,
  expectedType: string | null,
  key: string,
  keys: string[],
  currentObj: Record<string, unknown>
) {
  const parent = input.parentElement;

  // Handle Enabled/Disabled toggles (see text-conversation-rewards modules)
  if (parent?.hasAttribute("data-has-toggle") && (expectedType === null || expectedType === "null")) {
    currentObj[keys[keys.length - 1]] = handleToggleInput(parent, key);
    return;
  }

  let value: unknown;

  switch (expectedType) {
    case "boolean":
      value = (input as HTMLInputElement).checked;
      break;
    case "object":
    case "array": {
      value = parseJsonValue(input, expectedType, key);
      break;
    }
    case "number":
    case "integer":
      value = Number((input as HTMLInputElement).value);
      break;
    default:
      value = (input as HTMLInputElement).value;
  }

  // Handle cases where toggles influence the value directly such as
  // union selection options (see command-start-stop `Assigned Issue Scope`)
  if (!value && input.hasAttribute("data-has-toggle") && parent) {
    value = handleToggleInput(parent, key);
  }

  currentObj[keys[keys.length - 1]] = value;
}

function handleToggleInput(parent: HTMLElement, key: string): unknown {
  const toggleType = parent.getAttribute("data-toggle-type");
  const selected = parent.getAttribute(STRINGS.DATA_SELECTED);
  const textArea = parent.querySelector("textarea");

  if (!textArea) {
    // it's a non-null option toggle (see command-start-stop `Assigned Issue Scope`)
    // data-selected on the 2nd child element (td) is the value
    const selected = parent.querySelectorAll("td")[1].getAttribute(STRINGS.DATA_SELECTED);
    if (!selected) {
      throw new Error(`No selected value found for key "${key}"`);
    }
    return selected;
  }

  switch (toggleType) {
    case "union":
      /**
       * This is the actual value of the selected union type which is shown as a
       * toggle button. The value is the key of the selected union type.
       */
      return selected;
    case "config": {
      /**
       * We know that it cannot be disabled and so only the value is relevant.
       *
       * Obtain the `kind` from the toggle and parse the value of the textarea
       * then merge the two together, as `kind` is required from by the typebox schema.
       */

      const kind = parent.getAttribute("data-selected");
      if (!kind) {
        throw new Error(`No kind found for key "${key}"`);
      }

      return {
        kind,
        value: JSON.parse(textArea.value),
      };
    }
    case "boolean":
      /**
       * When enabled, the input has a value, when disabled, the input has a placeholder.
       * Schema validation often requires a non-null value, so we need to parse the value
       * when the toggle is enabled, and the placeholder when it's disabled which is likely to be
       * an empty object or array for example.
       *
       * This is for improved user feedback when the user disables the toggle.
       */
      return selected === "Enabled" ? JSON.parse(textArea.value) : JSON.parse(textArea.placeholder);
    default:
      return textArea.value;
  }
}

function parseJsonValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLDivElement, expectedType: string, key: string): unknown {
  if ("value" in input && !input.value) {
    return expectedType === "object" ? {} : [];
  }
  try {
    /**
     * If the input is a textarea, we parse the value of the textarea, otherwise we parse the value of the input.
     */
    return JSON.parse("value" in input ? input.value : input.textContent || "");
  } catch (e) {
    console.error(e);
    throw new Error(`Invalid JSON input for ${expectedType} at key "${key}": ${"value" in input ? input.value : input.textContent}`);
  }
}
