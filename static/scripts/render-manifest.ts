import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { ManifestCache, ManifestPreDecode, ManifestProps, Plugin } from "../types/plugins";
import { ConfigParser } from "./config-parser";
import { AuthService } from "./authentication";

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
        localStorage.setItem("selectedConfig", selectedConfig);
        this._renderPluginSelector(selectedConfig);
      }
    } catch (error) {
      console.error("Error handling configuration selection:", error);
      alert("An error occurred while selecting the configuration.");
    }
  }

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

    // Organization Picker Row
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

    // Configuration Picker Row
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

  private _createInputRow(key: string, prop: ManifestProps) {
    const row = document.createElement("tr");

    const headerCell = document.createElement("td");
    headerCell.className = "table-data-header";
    headerCell.textContent = key;
    row.appendChild(headerCell);

    const valueCell = document.createElement("td");
    valueCell.className = "table-data-value";

    const input = this._createInput(key, prop.default);
    valueCell.appendChild(input);

    row.appendChild(valueCell);
    this._manifestGuiBody.appendChild(row);

    // Store the default value and type in configDefaults
    this._configDefaults[key] = {
      type: prop.type,
      value: prop.default,
      items: prop.items ? { type: prop.items.type } : null,
    };
  }

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

  private _writeNewConfig(): void {
    const selectedManifest = localStorage.getItem("selectedPluginManifest");
    if (!selectedManifest) {
      throw new Error("No selected plugin manifest found");
    }
    const pluginManifest = JSON.parse(selectedManifest) as Manifest;
    const configInputs = document.querySelectorAll<HTMLInputElement>(".config-input");
    const newConfig = this._parseConfigInputs(configInputs);

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
          await this._configParser.pushConfigToRepo(org, config, octokit);
        } catch (error) {
          console.error("Error pushing config to GitHub:", error);
          this._toastNotification("An error occurred while pushing the configuration to GitHub.", {
            type: "error",
            shouldAutoDismiss: true,
          });
          return;
        }

        // Push to GitHub
        this._toastNotification("Configuration pushed to GitHub successfully.", {
          type: "success",
          shouldAutoDismiss: true,
        });
      },
    });
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
      setTimeout(() => toastElement.remove(), 250); // Match the CSS transition duration
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

    // Get or create the toast container
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = this._createElement("div", {
        class: "toast-container",
      });
      document.body.appendChild(toastContainer);
    }

    toastContainer.appendChild(toastElement);

    // Trigger the animation
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

  private _updateGuiTitle(title: string): void {
    const guiTitle = document.querySelector("#manifest-gui-title");
    if (!guiTitle) {
      throw new Error("GUI Title not found");
    }
    guiTitle.textContent = title;
  }

  private _parseArrayInput(input: HTMLInputElement): unknown[] {
    const arrayInputs = input.querySelectorAll<HTMLInputElement>(".array-input-value");
    const values: unknown[] = [];
    arrayInputs.forEach((arrayInput) => {
      values.push(arrayInput.value);
    });
    return values;
  }

  private _parseObjectInput(input: HTMLInputElement): Record<string, unknown> {
    const objectInputs = input.querySelectorAll<HTMLInputElement>(".object-input-row");
    const obj: Record<string, unknown> = {};
    objectInputs.forEach((objectInput) => {
      const keyInput = objectInput.querySelector<HTMLInputElement>(".object-input-key");
      const valueInput = objectInput.querySelector<HTMLInputElement>(".object-input-value");
      if (!keyInput || !valueInput) {
        throw new Error("Key and value inputs are required");
      }
      obj[keyInput.value] = valueInput.value;
    });
    return obj;
  }

  private _parseConfigInputs(configInputs: NodeListOf<HTMLInputElement>): { [key: string]: unknown } {
    const config: Record<string, unknown> = {};
    configInputs.forEach((input) => {
      const key = input.getAttribute("data-config-key");
      if (!key) {
        throw new Error("Input key is required");
      }
      let value: unknown;

      const defaultObj = this._configDefaults[key];
      if (!defaultObj) {
        throw new Error(`No default object found for key: ${key}`);
      }
      const { type } = defaultObj;

      if (type === "number") {
        value = Number(input.value);
      } else if (type === "boolean") {
        value = input.value === "true";
      } else if (type === "object") {
        value = this._parseObjectInput(input);
      } else if (type === "array") {
        value = this._parseArrayInput(input);
      } else {
        value = input.value;
      }

      // Handle nested keys
      if (key.includes(".")) {
        const keys = key.split(".");
        let currentObj = config;
        console.log("Keys", keys);
        for (let i = 0; i < keys.length - 1; i++) {
          currentObj[keys[i]] = currentObj[keys[i]] || {};
          currentObj = currentObj[keys[i]] as Record<string, unknown>;
        }
        currentObj[keys[keys.length - 1]] = value;
      } else {
        config[key] = value;
      }
    });
    return config;
  }

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

  private _createInput(input: string, defaultValue: string | boolean | object): HTMLElement {
    if (!input) {
      throw new Error("Input name is required");
    }

    if (!defaultValue) {
      throw new Error("Default value is required");
    }

    let ele;

    if (typeof defaultValue === "object") {
      ele = this._createObjectInput(input, defaultValue);
    }

    if (Array.isArray(defaultValue)) {
      ele = this._createArrayInput(input, defaultValue);
    }

    if (typeof defaultValue === "boolean") {
      ele = this._createBooleanInput(input, defaultValue);
    }

    if (typeof defaultValue === "string") {
      ele = this._createStringInput(input, defaultValue);
    }

    if (!ele) {
      throw new Error("Unable to create input");
    }

    return ele;
  }

  private _createStringInput(input: string, defaultValue: string): HTMLElement {
    const inputElem = this._createElement("input", {
      type: "text",
      id: input,
      name: input,
      "data-config-key": input,
      class: "config-input",
      value: defaultValue,
    });

    return inputElem;
  }

  private _createBooleanInput(input: string, defaultValue: boolean): HTMLElement {
    const inputElem = this._createElement("input", {
      type: "checkbox",
      id: input,
      name: input,
      "data-config-key": input,
      class: "config-input",
    });

    if (defaultValue) {
      inputElem.setAttribute("checked", "");
    }

    return inputElem;
  }

  private _createObjectInput(input: string, obj: object): HTMLElement {
    const inputElem = this._createElement("div", {
      id: input,
      name: input,
      "data-config-key": input,
      class: "config-input",
    });

    Object.entries(obj).forEach(([key, value]) => {
      const row = this._createElement("div", {
        class: "object-input-row",
      });

      const keyInput = this._createElement("input", {
        type: "text",
        class: "object-input-key",
        value: key,
      });

      const valueInput = this._createElement("input", {
        type: "text",
        class: "object-input-value",
        value: value,
      });

      row.appendChild(keyInput);
      row.appendChild(valueInput);
      inputElem.appendChild(row);
    });

    return inputElem;
  }

  private _createArrayInput(input: string, defaultValue: Array<unknown>): HTMLElement {
    const inputElem = this._createElement("div", {
      id: input,
      name: input,
      "data-config-key": input,
      class: "config-input",
    });

    defaultValue.forEach((value) => {
      const row = this._createElement("div", {
        class: "array-input-row",
      });

      const input = this._createElement("input", {
        type: "text",
        class: "array-input-value",
        value: value as string,
      });

      row.appendChild(input);
      inputElem.appendChild(row);
    });

    return inputElem;
  }
}
