import { ManifestCache, ManifestPreDecode, Plugin, Manifest } from "../types/plugins";
import { ConfigParser } from "./config-parser";
import { AuthService } from "./authentication";
import AJV, { AnySchemaObject } from "ajv";
import { createElement, createInputRow } from "../utils/element-helpers";
import { toastNotification } from "../utils/toaster";

const ajv = new AJV({ allErrors: true, coerceTypes: true, strict: true });

const TDV_CENTERED = "table-data-value centered";
const SELECT_ITEMS = ".select-items"
const SELECT_SELECTED = ".select-selected"
const SELECT_HIDE = "select-hide"
const SELECT_ARROW_ACTIVE = "select-arrow-active"

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
  private _currentStep: "orgPicker" | "pluginSelector" | "configEditor" = "orgPicker";
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
      case "pluginSelector": {
        this.renderOrgPicker(this._orgs);
        break;
      }
      case "configEditor": {
        this._renderPluginSelector();
        break;
      }
      default:
        break;
    }

    const readmeContainer = document.querySelector(".readme-container");
    if (readmeContainer) {
      readmeContainer.remove();
      this._manifestGui?.classList.remove("plugin-editor");
    }
  }

  // Event Handlers

  private _handleOrgSelection(org: string, fetchPromise?: Promise<Record<string, ManifestPreDecode>>): void {
    if (!org) {
      throw new Error("No org selected");
    }

    localStorage.setItem("selectedOrg", org);

    if (fetchPromise) {
      fetchPromise.then((manifestCache) => {
        localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
      }).catch((error) => {
        console.error("Error fetching manifest cache:", error);
        toastNotification(`An error occurred while fetching the manifest cache: ${String(error)}`, {
          type: "error",
          shouldAutoDismiss: true,
        });
      });

      const fetchOrgConfig = async () => {
        const octokit = this._auth.octokit;
        if (!octokit) {
          throw new Error("No org or octokit found");
        }
        await this._configParser.fetchUserInstalledConfig(org, octokit);
        this._renderPluginSelector();
      }
      fetchOrgConfig().catch(console.error);
    } else {
      this._renderPluginSelector();
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

  public renderOrgPicker(orgs: string[], fetchPromise?: Promise<Record<string, ManifestPreDecode>>): void {
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

    const customSelect = createElement("div", { class: "custom-select" });

    const selectSelected = createElement("div", {
      class: "select-selected",
      textContent: "Select an organization",
    });

    const selectItems = createElement("div", {
      class: "select-items select-hide",
    });

    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);

    pickerCell.appendChild(customSelect);
    pickerRow.appendChild(pickerCell);

    this._manifestGuiBody.appendChild(pickerRow);
    this._manifestGui?.classList.add("rendered");

    if (!orgs.length) {
      const hasSession = this._auth.isActiveSession();
      if (hasSession) {
        this._updateGuiTitle("No organizations found");
      } else {
        this._updateGuiTitle("Please sign in to GitHub");
      }
      return;
    }

    this._updateGuiTitle("Select an Organization");

    orgs.forEach((org) => {
      const optionDiv = createElement("div", { class: "select-option" });
      const textSpan = createElement("span", { textContent: org });

      optionDiv.appendChild(textSpan);

      optionDiv.addEventListener("click", () => {
        this._handleOrgSelection(org, fetchPromise);
        selectSelected.textContent = org;
        localStorage.setItem("selectedOrg", org);
      });

      selectItems.appendChild(optionDiv);
    });

    selectSelected.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllSelect();
      selectItems.classList.toggle(SELECT_HIDE);
      selectSelected.classList.toggle(SELECT_ARROW_ACTIVE);
    });

    function closeAllSelect() {
      const selectItemsList = document.querySelectorAll(SELECT_ITEMS);
      const selectSelectedList = document.querySelectorAll(SELECT_SELECTED);
      selectItemsList.forEach((item) => {
        item.classList.add(SELECT_HIDE);
      });
      selectSelectedList.forEach((item) => {
        item.classList.remove(SELECT_ARROW_ACTIVE);
      });
    }

    document.addEventListener("click", closeAllSelect);
  }

  private _renderPluginSelector(): void {
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

    const userConfig = this._configParser.repoConfig;
    let installedPlugins: Plugin[] = [];

    if (userConfig) {
      installedPlugins = this._configParser.parseConfig(userConfig).plugins
    }

    const cleanManifestCache = Object.keys(manifestCache).reduce((acc, key) => {
      if (manifestCache[key]?.name) {
        acc[key] = manifestCache[key];
      }
      return acc;
    }, {} as ManifestCache);

    const customSelect = createElement("div", { class: "custom-select" });

    const selectSelected = createElement("div", {
      class: "select-selected",
      textContent: "Select a plugin",
    });

    const selectItems = createElement("div", {
      class: "select-items select-hide",
    });

    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);

    pickerCell.appendChild(customSelect);
    pickerRow.appendChild(pickerCell);

    this._manifestGuiBody.appendChild(pickerRow);

    pluginUrls.forEach((url) => {
      if (!cleanManifestCache[url]?.name) {
        return;
      }

      const [, repo] = url.replace("https://raw.githubusercontent.com/", "").split("/");
      const reg = new RegExp(`${repo}`, "gi");
      const installedPlugin: Plugin | undefined = installedPlugins.find((plugin) => plugin.uses[0].plugin.match(reg));
      const defaultForInstalled: ManifestPreDecode | null = cleanManifestCache[url];
      const optionText = defaultForInstalled.name;
      const indicator = installedPlugin ? "🟢" : "🔴";

      const optionDiv = createElement("div", { class: "select-option" });
      const textSpan = createElement("span", { textContent: optionText });
      const indicatorSpan = createElement("span", { textContent: indicator });

      optionDiv.appendChild(textSpan);
      optionDiv.appendChild(indicatorSpan);

      optionDiv.addEventListener("click", () => {
        selectSelected.textContent = optionText;
        closeAllSelect();
        localStorage.setItem("selectedPluginManifest", JSON.stringify(defaultForInstalled));
        this._renderConfigEditor(defaultForInstalled, installedPlugin?.uses[0].with);
      });

      selectItems.appendChild(optionDiv);
    });

    selectSelected.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllSelect();
      selectItems.classList.toggle(SELECT_HIDE);
      selectSelected.classList.toggle(SELECT_ARROW_ACTIVE);
    });

    function closeAllSelect() {
      const selectItemsList = document.querySelectorAll(SELECT_ITEMS);
      const selectSelectedList = document.querySelectorAll(SELECT_SELECTED);
      selectItemsList.forEach((item) => {
        item.classList.add(SELECT_HIDE);
      });
      selectSelectedList.forEach((item) => {
        item.classList.remove(SELECT_ARROW_ACTIVE);
      });
    }

    document.addEventListener("click", closeAllSelect);
    this._updateGuiTitle(`Select a Plugin`);
  }

  private _boundConfigAdd = this._writeNewConfig.bind(this, "add");
  private _boundConfigRemove = this._writeNewConfig.bind(this, "remove");
  private _renderConfigEditor(pluginManifest: Manifest | null, plugin?: Plugin["uses"][0]["with"]): void {
    this._currentStep = "configEditor";
    this._backButton.style.display = "block";
    this._manifestGuiBody.innerHTML = null;
    this._controlButtons(false);
    this._processProperties(pluginManifest?.configuration?.properties || {});
    const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

    if (plugin) {
      configInputs.forEach((input) => {
        const key = input.getAttribute("data-config-key");
        if (!key) {
          throw new Error("Input key is required");
        }

        const keys = key.split(".");
        let currentObj = plugin
        for (let i = 0; i < keys.length; i++) {
          if (!currentObj[keys[i]]) {
            break;
          }
          currentObj = currentObj[keys[i]] as Record<string, unknown>;
        }

        let value: string;

        if (typeof currentObj === "object") {
          value = JSON.stringify(currentObj, null, 2);
        } else {
          value = currentObj as string;
        }

        if (input.tagName === "TEXTAREA") {
          (input as HTMLTextAreaElement).value = value;
        } else {
          (input as HTMLInputElement).value = value;
        }
      }
      );
    }

    const add = document.getElementById("add");
    const remove = document.getElementById("remove");
    if (!add || !remove) {
      throw new Error("Add or remove button not found");
    }
    add.addEventListener("click", this._boundConfigAdd);
    remove.addEventListener("click", this._boundConfigRemove);

    const manifestCache = JSON.parse(localStorage.getItem("manifestCache") || "{}") as ManifestCache;
    const pluginUrls = Object.keys(manifestCache);
    const pluginUrl = pluginUrls.find((url) => {
      return manifestCache[url].name === pluginManifest?.name;
    })

    if (!pluginUrl) {
      throw new Error("Plugin URL not found");
    }
    const readme = manifestCache[pluginUrl].readme;

    if (readme) {
      const viewportCell = document.getElementById("viewport-cell");
      if (!viewportCell) {
        throw new Error("Viewport cell not found");
      }
      const readmeContainer = document.createElement("div");
      readmeContainer.className = 'readme-container';
      readmeContainer.innerHTML = readme;
      viewportCell.insertAdjacentElement("afterend", readmeContainer);
    }

    this._updateGuiTitle(`Editing Configuration for ${pluginManifest?.name}`);
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

  // Configuration Parsing

  private _processProperties(props: Record<string, Manifest["configuration"]>, prefix: string | null = null) {
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
    toastNotification(`Configuration for ${pluginManifest.name
      } saved successfully.Do you want to push to GitHub ? `, {
      type: "success",
      actionText: "Push to GitHub",
      action: async () => {
        const octokit = this._auth.octokit;
        if (!octokit) {
          throw new Error("Octokit not found");
        }

        const org = localStorage.getItem("selectedOrg");

        if (!org) {
          throw new Error("No selected org found");
        }

        try {
          await this._configParser.updateConfig(org, octokit, "add");
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
    toastNotification(`Configuration for ${pluginManifest.name} removed successfully.Do you want to push to GitHub ? `, {
      type: "success",
      actionText: "Push to GitHub",
      action: async () => {
        const octokit = this._auth.octokit;
        if (!octokit) {
          throw new Error("Octokit not found");
        }

        const org = localStorage.getItem("selectedOrg");

        if (!org) {
          throw new Error("No selected org found");
        }

        try {
          await this._configParser.updateConfig(org, octokit, "remove");
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
