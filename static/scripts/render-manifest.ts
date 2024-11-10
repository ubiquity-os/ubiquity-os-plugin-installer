import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { ManifestCache, ManifestPreDecode, ManifestProps, Plugin } from "../types/plugins";
import { ConfigParser } from "./config-parser";
import { AuthService } from "./authentication";
import AJV, { AnySchemaObject } from "ajv";

const ajv = new AJV({ allErrors: true, coerceTypes: true, strict: true });

export class ManifestRenderer {
  private _manifestGui: HTMLElement;
  private _manifestGuiBody: HTMLElement;
  private _configParser = new ConfigParser();
  private _configDefaults: { [key: string]: { type: string; value: string; items: { type: string } | null } } = {};
  private _auth: AuthService;

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
    this._manifestGui?.classList.add("rendering");
    this._manifestGuiBody.innerHTML = "";

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 4;
    pickerCell.className = "table-data-value centered";

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

    const orgSelect = this._createElement("select", {
      id: "org-picker-select",
      class: "picker-select",
      style: "width: 100%",
    });

    const defaultOption = this._createElement("option", {
      value: "",
      textContent: "Found installations...",
    });
    orgSelect.appendChild(defaultOption);

    orgs.forEach((org) => {
      const option = this._createElement("option", {
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
    this._manifestGuiBody.innerHTML = "";

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 2;
    pickerCell.className = "table-data-value centered";

    const configSelect = this._createElement("select", {
      id: "config-selector-select",
      class: "picker-select",
    });

    const defaultOption = this._createElement("option", {
      value: "",
      textContent: "Select a configuration",
    });
    configSelect.appendChild(defaultOption);

    const configs = ["development", "production"];
    configs.forEach((config) => {
      const option = this._createElement("option", {
        value: config,
        textContent: config.charAt(0).toUpperCase() + config.slice(1),
      });
      configSelect.appendChild(option);
    });

    configSelect.addEventListener("change", this._handleConfigSelection.bind(this));
    pickerCell.appendChild(configSelect);
    pickerRow.appendChild(pickerCell);

    this._updateGuiTitle(`Select a Configuration for ${selectedOrg}`);
    this._manifestGuiBody.appendChild(pickerRow);
  }

  private _renderPluginSelector(selectedConfig: "development" | "production"): void {
    this._manifestGuiBody.innerHTML = "";

    const manifestCache = JSON.parse(localStorage.getItem("manifestCache") || "{}") as ManifestCache;
    const pluginUrls = Object.keys(manifestCache);

    const pickerRow = document.createElement("tr");
    const pickerCell = document.createElement("td");
    pickerCell.colSpan = 2;
    pickerCell.className = "table-data-value centered";

    const pluginSelect = this._createElement("select", {
      id: "plugin-selector-select",
      class: "picker-select",
    });

    const defaultOption = this._createElement("option", {
      value: "",
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
      const option = this._createElement("option", {
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
    this._manifestGuiBody.innerHTML = "";

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

  private _renderConfigEditor(manifestStr: string): void {
    this._manifestGuiBody.innerHTML = "";

    const pluginManifest = JSON.parse(manifestStr) as Manifest;
    const configProps = pluginManifest.configuration?.properties || {};
    this._processProperties(configProps);

    const add = document.getElementById("add");
    if (!add) {
      throw new Error("Add button not found");
    }
    add.addEventListener("click", this._writeNewConfig.bind(this));

    this._updateGuiTitle(`Editing Configuration for ${pluginManifest.name}`);
    this._controlButtons(false);
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

  private _toastNotification(
    message: string,
    options: {
      type?: "success" | "error" | "info" | "warning";
      actionText?: string;
      action?: () => void;
      shouldAutoDismiss?: boolean;
      duration?: number;
    } = {}
  ): void {
    const { type = "info", actionText, action, shouldAutoDismiss = false, duration = 5000 } = options;

    const toastElement = this._createElement("div", {
      class: `toast toast-${type}`,
    });

    const messageElement = this._createElement("span", {
      class: "toast-message",
      textContent: message,
    });

    const closeButton = this._createElement("button", {
      class: "toast-close",
      textContent: "X",
    });

    closeButton.addEventListener("click", () => {
      toastElement.classList.remove("show");
      setTimeout(() => toastElement.remove(), 250);
    });

    toastElement.appendChild(messageElement);

    if (action && actionText) {
      const actionButton = this._createElement("button", {
        class: "toast-action",
        textContent: actionText,
      });
      actionButton.addEventListener("click", action);
      toastElement.appendChild(actionButton);
    }

    toastElement.appendChild(closeButton);

    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = this._createElement("div", {
        class: "toast-container",
      });
      document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toastElement);

    requestAnimationFrame(() => {
      toastElement.classList.add("show");
    });

    if (shouldAutoDismiss) {
      setTimeout(() => {
        toastElement.classList.remove("show");
        setTimeout(() => toastElement.remove(), 250);
      }, duration);
    }
  }

  // Configuration Parsing

  private _processProperties(props: Record<string, ManifestProps>, prefix = "") {
    Object.keys(props).forEach((key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const prop = props[key];

      if (prop.type === "object" && prop.properties) {
        this._processProperties(prop.properties, fullKey);
      } else {
        this._createInputRow(fullKey, prop);
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

  private _writeNewConfig(): void {
    const selectedManifest = localStorage.getItem("selectedPluginManifest");
    if (!selectedManifest) {
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

    this._configParser.addPlugin(plugin);
    this._toastNotification(`Configuration for ${pluginManifest.name} saved successfully. Do you want to push to GitHub?`, {
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
          await this._configParser.updateConfig(org, config, octokit);
        } catch (error) {
          console.error("Error pushing config to GitHub:", error);
          this._toastNotification("An error occurred while pushing the configuration to GitHub.", {
            type: "error",
            shouldAutoDismiss: true,
          });
          return;
        }

        this._toastNotification("Configuration pushed to GitHub successfully.", {
          type: "success",
          shouldAutoDismiss: true,
        });
      },
    });
  }

  // Helper functions

  private _createElement<TK extends keyof HTMLElementTagNameMap>(tagName: TK, attributes: { [key: string]: string }): HTMLElementTagNameMap[TK] {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach((key) => {
      if (key === "textContent") {
        element.textContent = attributes[key];
      } else if (key in element) {
        (element as Record<string, string>)[key] = attributes[key];
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });
    return element;
  }
  private _createInputRow(key: string, prop: ManifestProps) {
    const row = document.createElement("tr");

    const headerCell = document.createElement("td");
    headerCell.className = "table-data-header";
    headerCell.textContent = key;
    row.appendChild(headerCell);

    const valueCell = document.createElement("td");
    valueCell.className = "table-data-value";

    const input = this._createInput(key, prop.default, prop);
    valueCell.appendChild(input);

    row.appendChild(valueCell);
    this._manifestGuiBody.appendChild(row);

    this._configDefaults[key] = {
      type: prop.type,
      value: prop.default,
      items: prop.items ? { type: prop.items.type } : null,
    };
  }
  private _createInput(key: string, defaultValue: unknown, prop: ManifestProps): HTMLElement {
    if (!key) {
      throw new Error("Input name is required");
    }

    let ele: HTMLElement;

    const dataType = prop.type;

    if (dataType === "object" || dataType === "array") {
      ele = this._createTextareaInput(key, defaultValue, dataType);
    } else if (dataType === "boolean") {
      ele = this._createBooleanInput(key, defaultValue);
    } else {
      ele = this._createStringInput(key, defaultValue, dataType);
    }

    return ele;
  }
  private _createStringInput(key: string, defaultValue: string | unknown, dataType: string): HTMLElement {
    const inputElem = this._createElement("input", {
      type: "text",
      id: key,
      name: key,
      "data-config-key": key,
      "data-type": dataType,
      class: "config-input",
      value: `${defaultValue}`,
    });
    return inputElem;
  }
  private _createBooleanInput(key: string, defaultValue: boolean | unknown): HTMLElement {
    const inputElem = this._createElement("input", {
      type: "checkbox",
      id: key,
      name: key,
      "data-config-key": key,
      "data-type": "boolean",
      class: "config-input",
    });

    if (defaultValue) {
      inputElem.setAttribute("checked", "");
    }

    return inputElem;
  }
  private _createTextareaInput(key: string, defaultValue: object | unknown, dataType: string): HTMLElement {
    const inputElem = this._createElement("textarea", {
      id: key,
      name: key,
      "data-config-key": key,
      "data-type": dataType,
      class: "config-input",
      rows: "5",
      cols: "50",
    });
    inputElem.textContent = JSON.stringify(defaultValue, null, 2);

    inputElem.setAttribute("placeholder", `Enter ${dataType} in JSON format`);

    return inputElem;
  }
}
