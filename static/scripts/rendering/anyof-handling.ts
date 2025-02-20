import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { createElement, createConfigParamTooltip, manifestGuiBody } from "../../utils/element-helpers";

type Member = {
  type: string;
  description: string;
  examples: string[];
  default: string;
  properties: Record<
    string,
    {
      kind: { const: string };
      description: string;
      examples: string[];
      default: string;
    }
  >;
};

/**
 * Configs exist wherein the two options are either defined or `null` (text-conversation-rewards), the assumption
 * is then that any `Plugin-Input` that uses a setup like this is signalling that it's a boolean toggle for that module.
 *
 * See https://github.com/ubiquity-os-marketplace/text-conversation-rewards/blob/development/src/types/plugin-input.ts#L53
 * vs
 * https://github.com/ubiquity-os-marketplace/ubiquity-os-kernel-telegram/blob/development/src/types/plugin-inputs.ts#L24
 *
 * ```ts
 * contentEvaluator: T.Union([contentEvaluatorConfigurationType, T.Null()], { default: null }),
 * // vs
 * aiConfig: T.Union([T.Object(....), T.Object(....)], { default: null }),
 * ```
 *
 * The former is a boolean toggle, the latter is a configuration toggle with two options, none of them being 'disabled'.
 * In any scenario where we detect this, we render `Enable` and `Disable` buttons. Otherwise,
 * we render using the union discriminator using the `const` value of the `kind` property
 * which is the TypeBox/TypeBox-Validators standard.
 */
export function createAnyOfToggle(key: string, prop: Manifest["configuration"], configDefaults: Record<string, unknown>) {
  const { kindConfigs, kinds } = processAnyOfProperties(prop);

  const row = createElement("tr", {});
  const headerCell = createElement("td", {});
  headerCell.className = "table-data-header";
  headerCell.textContent = key.replace(/([A-Z])/g, " $1");
  row.appendChild(headerCell);

  const valueCell = createElement("td", {});
  valueCell.className = "table-data-value config-input buttons";
  valueCell.dataset.hasToggle = "true";
  valueCell.dataset.selected = kinds[0];
  valueCell.dataset.configKey = key;
  valueCell.id = key;
  row.appendChild(valueCell);

  const buttonGroup = createElement("div", {});
  buttonGroup.className = "button-group";
  createToggleOptions(kinds, kindConfigs, valueCell, buttonGroup);
  valueCell.appendChild(buttonGroup);

  // we only need a textarea for object types; string array unions are handled by the buttons
  let textarea = null;

  if (Object.values(kindConfigs).some((config) => config?.type === "object")) {
    textarea = createElement("textarea", {
      class: "config-input",
      "data-config-key": key,
      value: buildCleanConfigObject(prop?.anyOf[0]),
      rows: `${kinds.length + 1}`,
    });
  } else {
    valueCell.dataset.toggleType = "union";
  }

  buttonGroup.childNodes.forEach((button) => {
    if ((button as HTMLButtonElement).value === kinds[0]) {
      (button as HTMLButtonElement).classList.add("selected");
    }
  });

  // build the first tooltip
  if (prop && "description" in prop && prop.description) {
    createConfigParamTooltip(headerCell, {
      ...prop,
      id: `tooltip-${key}`,
    });
  } else {
    const { description, examples } = findDescriptionAndExamples(kinds[0], kinds, kindConfigs);
    createConfigParamTooltip(headerCell, {
      description,
      examples,
      id: `tooltip-${key}`,
    });
  }

  // replace the tooltip with the new one when the option is changed
  buttonGroup.childNodes.forEach((button, index) => {
    (button as HTMLButtonElement).onclick = () => {
      const isDisabled = (button as HTMLButtonElement).value === "Disabled";
      const isEnabled = (button as HTMLButtonElement).value === "Enabled";
      if (textarea && isEnabled) {
        textarea.value = buildCleanConfigObject(prop?.anyOf[index]);
      } else if (textarea && isDisabled) {
        textarea.value = "";
        textarea.placeholder = buildCleanConfigObject(prop?.anyOf[index]);
      }
      valueCell.dataset.selected = kinds[index];

      const tooltip = document.getElementById(`tooltip-${key}`);
      if (tooltip) {
        tooltip.remove();
      }

      const { description, examples } = findDescriptionAndExamples(kinds[index], kinds, kindConfigs);

      // build a custom tooltip for the `Disabled` option
      if (!description && !examples && buttonGroup.childNodes.length === 2 && "Enabled" in kindConfigs && "Disabled" in kindConfigs) {
        createConfigParamTooltip(headerCell, {
          description: `\`${key}\` can be either 'Enabled' or 'Disabled', please refer to the plugin documentation for more information on what disabling this feature does.\n\n The placeholder text in the textarea will be updated to reflect the configuration object for the selected option.`,
          examples: `Choose between 'Enabled' and 'Disabled'.`,
          id: `tooltip-${key}`,
        });
      } else if (!description && !examples && !("Enabled" in kindConfigs) && !("Disabled" in kindConfigs)) {
        // likely a string array union whose parent has the description
        if (prop && "description" in prop && prop.description) {
          createConfigParamTooltip(headerCell, {
            ...prop,
            id: `tooltip-${key}`,
          });
        }
      } else {
        createConfigParamTooltip(headerCell, {
          description,
          examples,
          id: `tooltip-${key}`,
        });
      }

      buttonGroup.childNodes.forEach((button) => {
        (button as HTMLButtonElement).classList.remove("selected");
      });
      (button as HTMLButtonElement).classList.add("selected");
    };
  });

  row.appendChild(headerCell);
  if (textarea) {
    valueCell.appendChild(textarea);
  }

  row.appendChild(valueCell);
  manifestGuiBody?.appendChild(row);
  configDefaults[key] = {
    type: "anyOf",
    value: prop?.anyOf[0],
  };
}

/**
 * Processes the `anyOf` properties of a configuration object and determines if:
 * - The configuration is a boolean toggle.
 * - The configuration is a configuration toggle.
 * 
 * ---
 * 
 * [`Typebox-Validators`](https://github.com/jtlapp/typebox-validators?tab=readme-ov-file#discriminated-union-examples)

 * ```ts
 *  const schema1 = Type.Union([
 *       Type.Object({
 *         kind: Type.Literal('string'),
 *         val: Type.String(),
 *       }),
 *       Type.Null(),
 *     ]);
 * ```
 * - Above is simply a union of an object and `null`, in this case, the options are `Enabled` and `Disabled`. ([Text Conversation Rewards Manifest.json](https://github.com/ubiquity-os-marketplace/text-conversation-rewards/blob/fc949f518b5daa44014e4ac1d234b65c06e407de/manifest.json#L291))
 * ---
 * - Below is a union of two config styles, in this case, the options are `OpenAi` and `OpenRouter`. ([Telegram Kernel Manifest.json](https://github.com/ubiquity-os-marketplace/ubiquity-os-kernel-telegram/blob/development/manifest.json#L77))
 * 
 * ```ts
 *  const schema2 = Type.Union([
 *       Type.Object({
 *         kind: Type.Literal(`OpenAi`),
 *         val: Type.String(),
 *       }),
 *      Type.Object({
 *        kind: Type.Literal(`OpenRouter`),
 *        val: Type.String(),
 *      }),
 *     ]);
 * ```
 */
function processAnyOfProperties(prop: Manifest["configuration"]) {
  let kinds: string[] = [];
  let kindConfigs: Record<string, Manifest["configuration"]> = {};

  try {
    kinds = prop?.anyOf.map((member: Member) => {
      if (member.type === "null") {
        return "Disabled";
      }

      if ("const" in member) {
        return member.const as string;
      }

      if ("properties" in member) {
        if ("kind" in member.properties && "const" in member.properties.kind) {
          return member.properties.kind.const as string;
        }
        return "Enabled";
      } else {
        return "Disabled";
      }
    });

    kindConfigs = prop?.anyOf.reduce((acc: Record<string, Manifest["configuration"]>, member: Member) => {
      if (member.type === "null") {
        acc["Disabled"] = member;
        return acc;
      }

      // string array union like `AssignedIssueScope` in `command-start-stop`
      if ("const" in member) {
        acc[member.const as string] = member;
        return acc;
      }

      // object union of object like `aiConfig` in `telegram-kernel`
      if ("properties" in member) {
        if ("kind" in member.properties && "const" in member.properties.kind) {
          acc[member.properties.kind.const as string] = member;
        } else {
          acc["Enabled"] = member;
        }
      } else {
        acc["Disabled"] = member;
      }
      return acc;
    }, {});
  } catch (e) {
    console.error(e);
  }

  return { kinds, kindConfigs };
}

function createToggleOptions(
  kinds: string[],
  kindConfigs: Record<string, Manifest["configuration"]>,
  valueCell: HTMLTableCellElement,
  buttonGroup: HTMLDivElement
) {
  function buildButton(kind: string) {
    const button = createElement("button", {
      class: "button",
      textContent: kind,
      value: kind,
    });

    if (kind === "Disabled" || kind === "Enabled") {
      valueCell.dataset.toggleType = "boolean";
    }

    button.onclick = () => {
      const config = kindConfigs[kind];

      const textarea = valueCell.querySelector("textarea");
      if (textarea) {
        textarea.placeholder = buildCleanConfigObject(config);
      }

      const input = valueCell.querySelector("input");
      if (input) {
        input.value = config?.default;
      }
    };
    buttonGroup.appendChild(button);
  }

  // We know that if the kinds array has a length of 2 and includes `null` and `undefined`
  // then we can assume it's a boolean toggle. Otherwise, we render the union discriminator.

  if ((kinds.includes("null") || kinds.includes("undefined")) && kinds.length === 2) {
    kinds.forEach((kind: string) => {
      if (kind === "null" || kind === "undefined") {
        kind = "Disabled";
      } else {
        kind = "Enabled";
      }
      buildButton(kind);
    });
  } else {
    valueCell.dataset.toggleType = "config";
    kinds?.forEach((kind: string) => {
      buildButton(kind);
    });
  }
}

/**
 * Because these items are rendered within textarea elements as an editable JSON object, we need to provide
 * a description and examples for each property in the configuration object. As opposed to standard object props
 * which are rendered as input elements and have a tooltip specific to the property.
 */
function findDescriptionAndExamples(indexer: string, kinds: string[] = ["Enabled", "Disabled"], kindConfigs: Record<string, Manifest["configuration"]> = {}) {
  const index = kinds.indexOf(indexer);
  if (index === -1) {
    return { description: "", examples: "" };
  }

  const props = kindConfigs[indexer]?.properties as Record<string, Member>;

  if (!props) {
    return { description: "", examples: "" };
  }

  let description = "";
  let examples = "";

  for (const [key, prop] of Object.entries(props)) {
    if (key === "kind") {
      // internal to typebox and although it has a description, it's likely more confusing than helpful
      // as it's not required in the config object. The selection buttons display the kind anyway.
      continue;
    }

    if (prop.description) {
      description += `-\`${key}\`: ${prop.description}\n`;
    }

    if (prop.examples) {
      examples += `-\`${key}\`: ${prop.examples}\n`;
    }

    if (prop.properties) {
      const keys = Object.keys(prop.properties);
      Object.values(prop.properties).forEach((subProp, index) => {
        if (subProp.description) {
          description += `- \`${keys[index]}\`: ${subProp.description}\n\n`;
        }

        if (subProp.examples) {
          examples += `- \`${keys[index]}\`: ${subProp.examples}\n\n`;
        }
      });
    }
  }

  return { description, examples };
}

/**
 * This function is used to create a clean configuration object for the placeholder of the textarea.
 *
 * Effectively this fn does the same as processProperties but without creating elements.
 */
export function buildCleanConfigObject(config: Manifest["configuration"]): string {
  const obj: Record<string, unknown> = {};
  if (!config) {
    return JSON.stringify(obj, null, 2);
  }
  if (config.properties) {
    Object.keys(config.properties).forEach((key) => {
      const prop = config.properties[key];
      if (prop.type === "object" && prop.properties) {
        obj[key] = JSON.parse(buildCleanConfigObject(prop));
      } else {
        obj[key] = prop.default;
      }
    });
  }

  return JSON.stringify(obj, null, 2);
}
