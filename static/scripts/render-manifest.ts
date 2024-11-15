import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { ManifestCache, ManifestPreDecode, ManifestProps, Plugin } from "../types/plugins";
import { ConfigParser } from "./config-parser";
import { AuthService } from "./authentication";
import AJV, { AnySchemaObject } from "ajv";
import { createElement, createInputRow } from "../utils/ele-helpers";
import { toastNotification } from "../utils/toaster";

const ajv = new AJV({ allErrors: true, coerceTypes: true, strict: true });

const TDV_CENTERED = "table-data-value centered";
const PICKER_SELECT_STR = "picker-select";

type ExtendedHtmlElement<T = HTMLElement> = {
  [key in keyof T]: T[key] extends HTMLElement["innerHTML"] ? string | null : T[key];
};

export class ManifestRenderer {
  private _manifestGui: HTMLElement;
  private _manifestGuiBody: ExtendedHtmlElement;
  private _configParser = new ConfigParser();
  private _configDefaults: { [key: string]: { type: string; value: string; items: { type: string } | null } } = {};
  private _auth: AuthService;
  private _backButton: HTMLButtonElement;
  private _currentStep: "orgPicker" | "configSelector" | "pluginSelector" | "configEditor" = "orgPicker";
  private _orgs: string[] = [];

  constructor(auth: AuthService) {
    this._auth = auth;
    const manifestGui = document.querySelector("#manifest-gui");
    const manifestGuiBody = document.querySelector("#manifest-gui-body");

    if (!manifestGui || !manifestGuiBody) {
      throw new Error("Manifest GUI not found");
    }

    this._manifestGui = manifestGui as HTMLElement;
    this._manifestGuiBody = manifestGuiBody as HTMLElement;
    this._controlButtons(true);

    this._backButton = createElement("button", {
      id: "back-button",
      class: "button",
      textContent: "Back",
    }) as HTMLButtonElement;

    const title = manifestGui.querySelector("#manifest-gui-title");
    title?.previousSibling?.appendChild(this._backButton);
    this._backButton.style.display = "none";
    this._backButton.addEventListener("click", this._handleBackButtonClick.bind(this));
  }

  private _handleBackButtonClick(): void {
    switch (this._currentStep) {
      case "configSelector": {
        this.renderOrgPicker(this._orgs);
        break;
      }
      case "pluginSelector": {
        const selectedConfig = localStorage.getItem("selectedConfig") as "development" | "production";
        this._renderConfigSelector(selectedConfig);
        break;
      }
      case "configEditor": {
        const selectedConfig = localStorage.getItem("selectedConfig") as "development" | "production";
        this._renderPluginSelector(selectedConfig);
        break;
      }
      default:
        break;
    }
  }

  // Event Handlers

  private _handleOrgSelection(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedOrg = selectElement.value;
    if (selectedOrg) {
      localStorage.setItem("selectedOrg", selectedOrg);
      this._renderConfigSelector(selectedOrg);
    }
  }

  private _handlePluginSelection(event: Event): void {
    try {
      const selectElement = event.target as HTMLSelectElement;
      const selectedPluginManifest = selectElement.value;
      if (selectedPluginManifest) {
        localStorage.setItem("selectedPluginManifest", selectedPluginManifest);
        this._renderConfigEditor(selectedPluginManifest);
      }
    } catch (error) {
      console.error("Error handling plugin selection:", error);
      alert("An error occurred while selecting the plugin.");
    }
  }

  private _handleConfigSelection(event: Event): void {
    try {
      const selectElement = event.target as HTMLSelectElement;
      const selectedConfig = selectElement.value as "development" | "production";
      if (selectedConfig) {
        const fetchOrgConfig = async () => {
          const org = localStorage.getItem("selectedOrg");
          const octokit = this._auth.octokit;
          if (!org || !octokit) {
            throw new Error("No org or octokit found");
          }
          await this._configParser.fetchUserInstalledConfig(org, selectedConfig, octokit);
        };
        localStorage.setItem("selectedConfig", selectedConfig);
        this._renderPluginSelector(selectedConfig);
        fetchOrgConfig().catch(console.error);
      }
    } catch (error) {
      console.error("Error handling configuration selection:", error);
      alert("An error occurred while selecting the configuration.");
    }
  }

  // UI Rendering

  private _controlButtons(hide: boolean): void {
    const addButton = document.getElementById("add");
    const removeButton = document.getElementById("remove");
    if (addButton) {
      addButton.style.display = hide ? "none" : "inline-block";
    }
    if (removeButton) {
      removeButton.style.display = hide ? "none" : "inline-block";
    }

    this._manifestGui?.classList.add("rendered");
  }

  public renderOrgPicker(orgs: string[]): void {
    this._orgs = orgs;
    this._currentStep = "orgPicker";
    this._controlButtons(true);
    this._backButton.style.display = "none";
    this._manifestGui?.classList.add("rendering");
    this._manifestGuiBody.innerHTML = null;

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 4;
    pickerCell.className = TDV_CENTERED;

    if (!orgs.length) {
      const hasSession = this._auth.isActiveSession();
      if (hasSession) {
        this._updateGuiTitle("No installations found");
        this._manifestGuiBody.appendChild(pickerRow);
        this._manifestGui?.classList.add("rendered");
      } else {
        this._updateGuiTitle("Please sign in to GitHub");
      }
      return;
    }

    this._updateGuiTitle("Select an Organization");

    const orgSelect = createElement("select", {
      id: "org-picker-select",
      class: PICKER_SELECT_STR,
      style: "width: 100%",
    });

    const defaultOption = createElement("option", {
      value: null,
      textContent: "Found installations...",
    });
    orgSelect.appendChild(defaultOption);

    orgs.forEach((org) => {
      const option = createElement("option", {
        value: org,
        textContent: org,
      });
      orgSelect.appendChild(option);
    });

    orgSelect.addEventListener("change", this._handleOrgSelection.bind(this));
    pickerCell.appendChild(orgSelect);
    pickerRow.appendChild(pickerCell);
    this._manifestGuiBody.appendChild(pickerRow);
    this._manifestGui?.classList.add("rendered");
  }

  private _renderConfigSelector(selectedOrg: string): void {
    this._currentStep = "configSelector";
    this._backButton.style.display = "block";
    this._manifestGuiBody.innerHTML = null;
    this._controlButtons(true);

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 2;
    pickerCell.className = TDV_CENTERED;

    const configSelect = createElement("select", {
      id: "config-selector-select",
      class: PICKER_SELECT_STR,
    });

    const defaultOption = createElement("option", {
      value: null,
      textContent: "Select a configuration",
    });
    configSelect.appendChild(defaultOption);

    const configs = ["development", "production"];
    configs.forEach((config) => {
      const option = createElement("option", {
        value: config,
        textContent: config.charAt(0).toUpperCase() + config.slice(1),
      });
      configSelect.appendChild(option);
    });

    configSelect.removeEventListener("change", this._handleConfigSelection.bind(this));
    configSelect.addEventListener("change", this._handleConfigSelection.bind(this));
    pickerCell.appendChild(configSelect);
    pickerRow.appendChild(pickerCell);

    this._updateGuiTitle(`Select a Configuration for ${selectedOrg}`);
    this._manifestGuiBody.appendChild(pickerRow);
  }

  private _renderPluginSelector(selectedConfig: "development" | "production"): void {
    this._currentStep = "pluginSelector";
    this._backButton.style.display = "block";
    this._manifestGuiBody.innerHTML = null;
    this._controlButtons(true);

    const manifestCache = JSON.parse(localStorage.getItem("manifestCache") || "{}") as ManifestCache;
    const pluginUrls = Object.keys(manifestCache);

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 2;
    pickerCell.className = TDV_CENTERED;

    const pluginSelect = createElement("select", {
      id: "plugin-selector-select",
      class: PICKER_SELECT_STR,
    });

    const defaultOption = createElement("option", {
      value: null,
      textContent: "Select a plugin",
    });
    pluginSelect.appendChild(defaultOption);

    const cleanManifestCache = Object.keys(manifestCache).reduce((acc, key) => {
      if (manifestCache[key]?.name) {
        acc[key] = manifestCache[key];
      }
      return acc;
    }, {} as ManifestCache);

    pluginUrls.forEach((url) => {
      if (!cleanManifestCache[url]?.name) {
        return;
      }
      const option = createElement("option", {
        value: JSON.stringify(cleanManifestCache[url]),
        textContent: cleanManifestCache[url]?.name,
      });
      pluginSelect.appendChild(option);
    });

    pluginSelect.addEventListener("change", this._handlePluginSelection.bind(this));
    pickerCell.appendChild(pluginSelect);
    pickerRow.appendChild(pickerCell);

    this._updateGuiTitle(`Select a Plugin for ${selectedConfig}`);
    this._manifestGuiBody.appendChild(pickerRow);
  }

  renderManifest(decodedManifest: ManifestPreDecode) {
    if (!decodedManifest) {
      throw new Error("No decoded manifest found!");
    }
    this._manifestGui?.classList.add("rendering");
    this._manifestGuiBody.innerHTML = null;

    const table = document.createElement("table");
    Object.entries(decodedManifest).forEach(([key, value]) => {
      const row = document.createElement("tr");

      const headerCell = document.createElement("td");
      headerCell.className = "table-data-header";
      headerCell.textContent = key.replace("ubiquity:", "");
      row.appendChild(headerCell);

      const valueCell = document.createElement("td");
      valueCell.className = "table-data-value";

      if (typeof value === "string") {
        valueCell.textContent = value;
      } else {
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(value, null, 2);
        valueCell.appendChild(pre);
      }

      row.appendChild(valueCell);
      table.appendChild(row);
    });

    this._manifestGuiBody.appendChild(table);
    this._manifestGui?.classList.add("rendered");
  }

  private _boundConfigAdd = this._writeNewConfig.bind(this, "add");
  private _boundConfigRemove = this._writeNewConfig.bind(this, "remove");
  private _renderConfigEditor(manifestStr: string): void {
    this._currentStep = "configEditor";
    this._backButton.style.display = "block";
    this._manifestGuiBody.innerHTML = null;
    this._controlButtons(false);

    const pluginManifest = JSON.parse(manifestStr) as Manifest;
    const configProps = pluginManifest.configuration?.properties || {};
    this._processProperties(configProps);

    const add = document.getElementById("add");
    const remove = document.getElementById("remove");
    if (!add || !remove) {
      throw new Error("Add or remove button not found");
    }
    add.addEventListener("click", this._boundConfigAdd);
    remove.addEventListener("click", this._boundConfigRemove);

    this._updateGuiTitle(`Editing Configuration for ${pluginManifest.name}`);
    this._manifestGui?.classList.add("plugin-editor");
    this._manifestGui?.classList.add("rendered");
  }

  private _updateGuiTitle(title: string): void {
    const guiTitle = document.querySelector("#manifest-gui-title");
    if (!guiTitle) {
      throw new Error("GUI Title not found");
    }
    guiTitle.textContent = title;
  }

  // Configuration Parsing

  private _processProperties(props: Record<string, ManifestProps>, prefix: string | null = null) {
    Object.keys(props).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const prop = props[key];

      if (prop.type === "object" && prop.properties) {
        this._processProperties(prop.properties, fullKey);
      } else {
        createInputRow(fullKey, prop, this._configDefaults);
      }
    });
  }

  private _parseConfigInputs(configInputs: NodeListOf<HTMLInputElement | HTMLTextAreaElement>, manifest: Manifest): { [key: string]: unknown } {
    const config: Record<string, unknown> = {};
    const schema = manifest.configuration;
    if (!schema) {
      throw new Error("No schema found in manifest");
    }
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
      return config;
    } else {
      throw new Error("Invalid configuration: " + JSON.stringify(validate.errors, null, 2));
    }
  }

  private _writeNewConfig(option: "add" | "remove"): void {
    const selectedManifest = localStorage.getItem("selectedPluginManifest");
    if (!selectedManifest) {
      toastNotification("No selected plugin manifest found.", {
        type: "error",
        shouldAutoDismiss: true,
      });
      throw new Error("No selected plugin manifest found");
    }
    const pluginManifest = JSON.parse(selectedManifest) as Manifest;
    const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

    const newConfig = this._parseConfigInputs(configInputs, pluginManifest);

    this._configParser.loadConfig();

    const officialPluginConfig: Record<string, { actionUrl?: string; workerUrl?: string }> = JSON.parse(localStorage.getItem("officialPluginConfig") || "{}");

    const pluginName = pluginManifest.name;

    // this relies on the manifest matching the repo name
    const normalizedPluginName = pluginName
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");

    const pluginUrl = Object.keys(officialPluginConfig).find((url) => {
      return url.includes(normalizedPluginName);
    });

    if (!pluginUrl) {
      toastNotification(`No plugin URL found for ${pluginName}.`, {
        type: "error",
        shouldAutoDismiss: true,
      });
      throw new Error("No plugin URL found");
    }

    const plugin: Plugin = {
      uses: [
        {
          plugin: pluginUrl,
          with: newConfig,
        },
      ],
    };

    if (option === "add") {
      this._handleAddPlugin(plugin, pluginManifest);
    } else {
      this._handleRemovePlugin(plugin, pluginManifest);
    }
  }

  private _handleAddPlugin(plugin: Plugin, pluginManifest: Manifest): void {
    this._configParser.addPlugin(plugin);
    toastNotification(`Configuration for ${pluginManifest.name} saved successfully. Do you want to push to GitHub?`, {
      type: "success",
      actionText: "Push to GitHub",
      action: async () => {
        const octokit = this._auth.octokit;
        if (!octokit) {
          throw new Error("Octokit not found");
        }

        const org = localStorage.getItem("selectedOrg");
        const config = localStorage.getItem("selectedConfig") as "development" | "production";

        if (!org) {
          throw new Error("No selected org found");
        }

        if (!config) {
          throw new Error("No selected config found");
        }

        try {
          await this._configParser.updateConfig(org, config, octokit, "add");
        } catch (error) {
          console.error("Error pushing config to GitHub:", error);
          toastNotification("An error occurred while pushing the configuration to GitHub.", {
            type: "error",
            shouldAutoDismiss: true,
          });
          return;
        }

        toastNotification("Configuration pushed to GitHub successfully.", {
          type: "success",
          shouldAutoDismiss: true,
        });
      },
    });
  }

  private _handleRemovePlugin(plugin: Plugin, pluginManifest: Manifest): void {
    this._configParser.removePlugin(plugin);
    toastNotification(`Configuration for ${pluginManifest.name} removed successfully. Do you want to push to GitHub?`, {
      type: "success",
      actionText: "Push to GitHub",
      action: async () => {
        const octokit = this._auth.octokit;
        if (!octokit) {
          throw new Error("Octokit not found");
        }

        const org = localStorage.getItem("selectedOrg");
        const config = localStorage.getItem("selectedConfig") as "development" | "production";

        if (!org) {
          throw new Error("No selected org found");
        }

        if (!config) {
          throw new Error("No selected config found");
        }

        try {
          await this._configParser.updateConfig(org, config, octokit, "remove");
        } catch (error) {
          console.error("Error pushing config to GitHub:", error);
          toastNotification("An error occurred while pushing the configuration to GitHub.", {
            type: "error",
            shouldAutoDismiss: true,
          });
          return;
        }

        toastNotification("Configuration pushed to GitHub successfully.", {
          type: "success",
          shouldAutoDismiss: true,
        });
      },
    });
  }
}
