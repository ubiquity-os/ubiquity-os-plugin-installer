import { ManifestPreDecode, Plugin } from "../../types/plugins";
import { createElement } from "../../utils/element-helpers";
import { STRINGS } from "../../utils/strings";
import { ManifestRenderer } from "../render-manifest";
import { addTrackedEventListener, getTrackedEventListeners, removeTrackedEventListener, updateGuiTitle } from "./utils";
import { handleResetToDefault, writeNewConfig } from "./write-add-remove";

/**
 * Renders the configuration editor for a plugin.
 * The user can edit the configuration and save it to their config file.
 */
export function renderConfigEditor(renderer: ManifestRenderer, pluginManifest: ManifestPreDecode, installedConfig?: Record<string, unknown>): void {
  renderer.currentStep = "configEditor";
  renderer.manifestGuiBody.innerHTML = null;

  const parsedConfig = renderer.configParser.parseConfig();
  // for when `resetToDefault` is called and no plugin gets passed in, we still want to show the remove button
  const isInstalled = parsedConfig.plugins?.find((p) => {
    const matchName = pluginManifest.repoName || pluginManifest.name;
    return p.uses[0].plugin.includes(matchName);
  });

  const configurationProperties = pluginManifest.configuration.properties;
  const configurationDefault = pluginManifest.configuration.default;
  const configurationRequired = pluginManifest.configuration.required;

  const configurationTable = document.createElement("table");
  configurationTable.className = STRINGS.CONFIG_TABLE;

  const configurationTableBody = document.createElement("tbody");
  configurationTableBody.className = STRINGS.CONFIG_TABLE_BODY;

  const configurationTableHeader = document.createElement("tr");
  configurationTableHeader.className = STRINGS.CONFIG_TABLE_HEADER;

  const configurationTableHeaderCell = document.createElement("td");
  configurationTableHeaderCell.colSpan = 2;
  configurationTableHeaderCell.className = STRINGS.CONFIG_TABLE_HEADER_CELL;

  const configurationTableHeaderText = document.createElement("h3");
  configurationTableHeaderText.textContent = "Configuration";

  configurationTableHeaderCell.appendChild(configurationTableHeaderText);
  configurationTableHeader.appendChild(configurationTableHeaderCell);
  configurationTableBody.appendChild(configurationTableHeader);

  if (configurationProperties) {
    Object.entries(configurationProperties).forEach(([key]) => {
      const configurationRow = document.createElement("tr");
      configurationRow.className = STRINGS.CONFIG_ROW;

      const configurationLabelCell = document.createElement("td");
      configurationLabelCell.className = STRINGS.CONFIG_LABEL_CELL;

      const configurationLabel = document.createElement("label");
      configurationLabel.textContent = key;
      if (configurationRequired?.includes(key)) {
        configurationLabel.textContent += " *";
      }

      const configurationInputCell = document.createElement("td");
      configurationInputCell.className = STRINGS.CONFIG_INPUT_CELL;

      const configurationInput = document.createElement("input");
      configurationInput.type = "text";
      configurationInput.className = STRINGS.CONFIG_INPUT;
      configurationInput.value = (installedConfig?.[key] as string) || (configurationDefault[key] as string) || "";

      configurationLabelCell.appendChild(configurationLabel);
      configurationInputCell.appendChild(configurationInput);

      configurationRow.appendChild(configurationLabelCell);
      configurationRow.appendChild(configurationInputCell);

      configurationTableBody.appendChild(configurationRow);
    });
  }

  const configurationButtonRow = document.createElement("tr");
  configurationButtonRow.className = STRINGS.CONFIG_BUTTON_ROW;

  const configurationButtonCell = document.createElement("td");
  configurationButtonCell.colSpan = 2;
  configurationButtonCell.className = STRINGS.CONFIG_BUTTON_CELL;

  const configurationButtonGroup = createElement("div", { class: "button-group" });

  const configurationSaveButton = document.createElement("button");
  configurationSaveButton.textContent = isInstalled ? "Update" : "Install";
  configurationSaveButton.className = STRINGS.CONFIG_SAVE_BUTTON;

  const configurationResetButton = document.createElement("button");
  configurationResetButton.textContent = "Reset to Default";
  configurationResetButton.className = STRINGS.CONFIG_RESET_BUTTON;

  const configurationRemoveButton = document.createElement("button");
  configurationRemoveButton.textContent = "Remove";
  configurationRemoveButton.className = STRINGS.CONFIG_REMOVE_BUTTON;

  if (isInstalled) {
    configurationButtonGroup.appendChild(configurationRemoveButton);
  }

  configurationButtonGroup.appendChild(configurationResetButton);
  configurationButtonGroup.appendChild(configurationSaveButton);

  configurationButtonCell.appendChild(configurationButtonGroup);
  configurationButtonRow.appendChild(configurationButtonCell);
  configurationTableBody.appendChild(configurationButtonRow);

  configurationTable.appendChild(configurationTableBody);
  renderer.manifestGuiBody.appendChild(configurationTable);

  const saveButtonListener = () => {
    const inputs = document.querySelectorAll(`.${STRINGS.CONFIG_INPUT}`);
    const config: Record<string, string> = {};
    inputs.forEach((input: Element) => {
      if (input instanceof HTMLInputElement) {
        const label = input.parentElement?.previousElementSibling?.textContent;
        if (label) {
          config[label.replace(" *", "")] = input.value;
        }
      }
    });
    writeNewConfig(renderer, pluginManifest, config);
  };

  const resetButtonListener = () => {
    handleResetToDefault(renderer, pluginManifest);
  };

  const removeButtonListener = () => {
    const plugin: Plugin = {
      uses: [
        {
          plugin: pluginManifest.repoName || pluginManifest.name,
          with: {},
        },
      ],
    };
    renderer.configParser.removePlugin(plugin);
    handleResetToDefault(renderer);
  };

  addTrackedEventListener(configurationSaveButton, "click", saveButtonListener as EventListener);
  addTrackedEventListener(configurationResetButton, "click", resetButtonListener as EventListener);

  if (isInstalled) {
    addTrackedEventListener(configurationRemoveButton, "click", removeButtonListener as EventListener);
  }

  const oldSaveListener = getTrackedEventListeners(configurationSaveButton, "click").find((l) => l !== saveButtonListener);
  const oldResetListener = getTrackedEventListeners(configurationResetButton, "click").find((l) => l !== resetButtonListener);
  const oldRemoveListener = getTrackedEventListeners(configurationRemoveButton, "click").find((l) => l !== removeButtonListener);

  if (oldSaveListener) {
    removeTrackedEventListener(configurationSaveButton, "click", oldSaveListener);
  }
  if (oldResetListener) {
    removeTrackedEventListener(configurationResetButton, "click", oldResetListener);
  }
  if (oldRemoveListener) {
    removeTrackedEventListener(configurationRemoveButton, "click", oldRemoveListener);
  }

  updateGuiTitle(`Configure ${pluginManifest.name}`);
}
