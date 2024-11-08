import { Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { ManifestCache, ManifestPreDecode } from "../types/plugins";
import { ConfigParser } from "./config-parser";

export class ManifestRenderer {
  private manifestGui: HTMLElement;
  private manifestGuiBody: HTMLElement;
  private configParser = new ConfigParser();

  constructor() {
    this.manifestGui = document.querySelector('#manifest-gui')!;
    this.manifestGuiBody = document.querySelector('#manifest-gui-body')!;
  }

  private handleOrgSelection(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedOrg = selectElement.value;
    if (selectedOrg) {
      this.renderConfigSelector(selectedOrg);
    }
  }

  private handlePluginSelection(event: Event): void {
    try {
      const selectElement = event.target as HTMLSelectElement;
      const selectedPluginManifest = selectElement.value;
      if (selectedPluginManifest) {
        localStorage.setItem('selectedPluginManifest', selectedPluginManifest);
        this.renderConfigEditor(selectedPluginManifest);
      }
    } catch (error) {
      console.error('Error handling plugin selection:', error);
      alert('An error occurred while selecting the plugin.');
    }
  }

  private handleConfigSelection(event: Event): void {
    try {
      const selectElement = event.target as HTMLSelectElement;
      const selectedConfig = selectElement.value as "development" | "production";
      if (selectedConfig) {
        this.renderPluginSelector(selectedConfig);
      }
    } catch (error) {
      console.error('Error handling configuration selection:', error);
      alert('An error occurred while selecting the configuration.');
    }
  }

  public renderOrgPicker(orgs: string[]): void {
    const orgPicker = this.createElement('div', {
      id: 'org-picker',
      className: 'org-picker',
    });

    orgPicker.innerHTML = `
      <div class="org-picker__header">
        <h2 class="org-picker__title">Select an organization</h2>
        <p class="org-picker__description">Select an organization to view the manifest</p>
      </div>
      <div class="org-picker select">
        <select id="org-picker-select" class="org-picker__select" name="org-picker-select">
          <option value="">Select an organization</option>
        </select>
      </div>
    `;

    document.body.appendChild(orgPicker);

    const orgSelect = orgPicker.querySelector<HTMLSelectElement>(
      '#org-picker-select'
    );
    orgSelect?.addEventListener('change', this.handleOrgSelection.bind(this));

    orgs.forEach(org => {
      const option = this.createElement('option', { value: org, textContent: org });
      orgSelect?.appendChild(option);
    });
  }

  private renderConfigSelector(selectedOrg: string): void {
    const existingSelector = document.getElementById('config-selector');
    if (existingSelector) existingSelector.remove();

    const configSelector = this.createElement('div', {
      id: `config-selector-org-${selectedOrg}`,
      className: 'config-selector',
    });

    configSelector.innerHTML = `
      <div class="config-selector__header">
        <h2 class="config-selector__title">Select a configuration</h2>
        <p class="config-selector__description">Select a configuration to view the manifest</p>
      </div>
      <div class="config-selector select">
        <select id="config-selector-select" class="config-selector__select" name="config-selector-select">
          <option value="">Select a configuration</option>
        </select>
      </div>
    `;

    const container = document.getElementById('main-container')!;
    container.appendChild(configSelector);

    const select = configSelector.querySelector<HTMLSelectElement>(
      '#config-selector-select'
    );

    const configs = ["development", "production"];
    select?.addEventListener('change', this.handleConfigSelection.bind(this));

    configs.forEach(config => {
      const option = this.createElement('option', { value: config, textContent: config });
      select?.appendChild(option);
    });
  }

  private renderPluginSelector(selectedConfig: "development" | "production"): void {
    const existingSelector = document.getElementById('plugin-selector');
    if (existingSelector) existingSelector.remove();

    const manifestCache = JSON.parse(localStorage.getItem('manifestCache') || '{}') as ManifestCache;
    const pluginUrls = Object.keys(manifestCache);
    const pluginSelector = this.createElement('div', {
      id: `plugin-selector-config-${selectedConfig}`,
      className: 'plugin-selector',
    });

    pluginSelector.innerHTML = `
      <div class="plugin-selector__header">
        <h2 class="plugin-selector__title">Select a plugin</h2>
        <p class="plugin-selector__description">Select a plugin to view the manifest</p>
      </div>
      <div class="plugin-selector select">
        <select id="plugin-selector-select" class="plugin-selector__select" name="plugin-selector-select">
          <option value="">Select a plugin</option>
        </select>
      </div>
    `;

    const container = document.getElementById('main-container')!;
    container.appendChild(pluginSelector);

    const pluginSelect = pluginSelector.querySelector<HTMLSelectElement>(
      '#plugin-selector-select'
    );

    pluginUrls.forEach(url => {
      const option = this.createElement('option', {
        value: JSON.stringify(manifestCache[url]),
        textContent: manifestCache[url].name,
      });
      pluginSelect?.appendChild(option);
    });

    pluginSelect?.addEventListener('change', this.handlePluginSelection.bind(this));
  }

  private renderConfigEditor(manifestStr: string): void {
    const existingEditor = document.getElementById('config-editor');
    if (existingEditor) existingEditor.remove();

    const configEditor = this.createElement('div', {
      id: 'config-editor',
      className: 'config-editor',
    });

    const pluginManifest = JSON.parse(manifestStr) as Manifest;
    const configProps = pluginManifest.configuration?.properties;
    const configKeys = Object.keys(configProps);
    const configDefaults = configKeys.reduce((acc, key) => {
      acc[key] = configProps[key].default;
      return acc;
    }, {} as { [key: string]: any });
    const configSection = this.createSection('Configuration', configKeys, configDefaults);

    const listenerSection = this.createSection(
      'Listener',
      pluginManifest['ubiquity:listeners']
    );
    const commandSection = this.createSection(
      'Commands',
      Object.keys(pluginManifest.commands || {})
    );

    const header = this.createElement('div', {
      className: 'config-editor__header',
    });
    const title = document.createElement('h2');
    title.className = 'config-editor__title';
    title.textContent = 'Edit Configuration';
    const description = document.createElement('p');
    description.className = 'config-editor__description';
    description.textContent =
      'Edit the configuration for the selected plugin';
    header.appendChild(title);
    header.appendChild(description);
    configEditor.appendChild(header);

    const body = this.createElement('div', {
      className: 'config-editor__body',
    });
    body.appendChild(configSection);
    body.appendChild(listenerSection);
    body.appendChild(commandSection);
    configEditor.appendChild(body);

    const footer = this.createElement('div', {
      className: 'config-editor__footer',
    });
    const saveButton = this.createElement('button', {
      id: 'save-config-button',
      className: 'save-config-button',
    });
    saveButton.textContent = 'Save Configuration';
    footer.appendChild(saveButton);
    configEditor.appendChild(footer);

    const container = document.getElementById('main-container')!;
    container.appendChild(configEditor);

    this.addEditorListeners();
  }

  renderManifest(decodedManifest?: ManifestPreDecode, fromCache: boolean = false) {
    if (fromCache) {
      const manifestCache = JSON.parse(
        localStorage.getItem('manifestCache') || '{}'
      ) as ManifestCache;
      const selectedPluginName = localStorage.getItem('selectedPluginName')!;
      decodedManifest = manifestCache[selectedPluginName];
    }

    if (!decodedManifest) {
      throw new Error('No decoded manifest found!');
    }

    this.manifestGui?.classList.add('rendering');
    this.manifestGuiBody!.innerHTML = '';

    const table = document.createElement('table');
    Object.entries(decodedManifest).forEach(([key, value]) => {
      const row = document.createElement('tr');

      const headerCell = document.createElement('td');
      headerCell.className = 'table-data-header';
      headerCell.textContent = key.replace('ubiquity:', '');
      row.appendChild(headerCell);

      const valueCell = document.createElement('td');
      valueCell.className = 'table-data-value';

      if (typeof value === 'string') {
        valueCell.textContent = value;
      } else {
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(value, null, 2);
        valueCell.appendChild(pre);
      }

      row.appendChild(valueCell);
      table.appendChild(row);
    });

    this.manifestGuiBody!.appendChild(table);
    this.manifestGui?.classList.add('rendered');
  }

  private addEditorListeners(): void {
    const configEditor = document.getElementById('config-editor');
    const saveButton = configEditor?.querySelector<HTMLButtonElement>(
      '#save-config-button'
    );

    saveButton?.addEventListener('click', this.writeNewConfig.bind(this));
  }

  private writeNewConfig(): void {
    const pluginName = localStorage.getItem('selectedPluginName')!;
    let plugin = this.configParser.extractPlugin(pluginName);

    if (!plugin) {
      plugin = { uses: [{ plugin: pluginName, with: {} }] };
    }

    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.config-editor__section-body input'
    );
    inputs.forEach(input => {
      const key = input.getAttribute('data-config-key') || input.id;
      plugin!.uses[0].with[key] = input.value;
    });

    try {
      this.configParser.updatePlugin(plugin!);
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to write new config:', error);
      alert('An error occurred while saving the configuration.');
    }
  }

  private createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attributes: { [key: string]: string }
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach(key => {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  private createSection(
    title: string,
    inputs: string[] = [],
    defaults: { [key: string]: any } = {}
  ): HTMLElement {
    const section = document.createElement('div');
    section.className = 'config-editor__section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'config-editor__section-title';
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    const sectionBody = document.createElement('div');
    sectionBody.className = 'config-editor__section-body';

    inputs.forEach(input => {
      const defaultValue = defaults[input];
      const inputElement = this.createInput(input, defaultValue);
      sectionBody.appendChild(inputElement);
    });

    section.appendChild(sectionBody);
    return section;
  }

  private createInput(
    input: string,
    defaultValue: string = ''
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'config-editor__input-wrapper';

    const label = document.createElement('label');
    label.setAttribute('for', input);
    label.textContent = `${input}:`;

    const inputElem = document.createElement('input');
    inputElem.type = 'text';
    inputElem.id = input;
    inputElem.name = input;
    inputElem.setAttribute('data-config-key', input);
    inputElem.value = defaultValue;

    wrapper.appendChild(label);
    wrapper.appendChild(inputElem);

    return wrapper;
  }
}