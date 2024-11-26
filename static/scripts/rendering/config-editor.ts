import { Manifest, Plugin } from "../../types/plugins";
import { controlButtons } from "./control-buttons";
import { ManifestRenderer } from "../render-manifest";
import { processProperties } from "./input-parsing";
import { addTrackedEventListener, getTrackedEventListeners, normalizePluginName, removeTrackedEventListener, updateGuiTitle } from "./utils";
import { handleResetToDefault, writeNewConfig } from "./write-add-remove";
import MarkdownIt from "markdown-it";
import { getManifestCache } from "../../utils/storage";
const md = new MarkdownIt();

export function renderConfigEditor(renderer: ManifestRenderer, pluginManifest: Manifest | null, plugin?: Plugin["uses"][0]["with"]): void {
  renderer.currentStep = "configEditor";
  renderer.backButton.style.display = "block";
  renderer.manifestGuiBody.innerHTML = null;
  controlButtons({ hide: false });
  processProperties(renderer, pluginManifest?.configuration.properties || {});
  const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

  if (plugin) {
    configInputs.forEach((input) => {
      const key = input.getAttribute("data-config-key");
      if (!key) {
        throw new Error("Input key is required");
      }

      const keys = key.split(".");
      let currentObj = plugin;
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
    });
  }

  const add = document.getElementById("add") as HTMLButtonElement;
  const remove = document.getElementById("remove") as HTMLButtonElement;
  const resetToDefaultButton = document.getElementById("reset-to-default") as HTMLButtonElement;
  if (!add || !remove || !resetToDefaultButton) {
    throw new Error("Buttons not found");
  }

  const parsedConfig = renderer.configParser.parseConfig(renderer.configParser.repoConfig || localStorage.getItem("config"));
  const isInstalled = parsedConfig.plugins?.find((p) => p.uses[0].plugin.includes(normalizePluginName(pluginManifest?.name || "")));

  loadListeners({
    renderer,
    pluginManifest,
    withPluginOrInstalled: !!(plugin || isInstalled),
    add,
    remove,
    resetToDefaultButton,
  }).catch(console.error);

  if (plugin || isInstalled) {
    remove.disabled = false;
    remove.classList.remove("disabled");
  } else {
    remove.disabled = true;
    remove.classList.add("disabled");
  }

  resetToDefaultButton.hidden = !!plugin;
  const manifestCache = getManifestCache();
  const pluginUrls = Object.keys(manifestCache);
  const pluginUrl = pluginUrls.find((url) => {
    return manifestCache[url].name === pluginManifest?.name;
  });

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
    readmeContainer.className = "readme-container";
    readmeContainer.innerHTML = md.render(readme);
    viewportCell.appendChild(readmeContainer);
  }

  const org = localStorage.getItem("selectedOrg");

  updateGuiTitle(`Editing Configuration for ${pluginManifest?.name} in ${org}`);
  renderer.manifestGui?.classList.add("plugin-editor");
  renderer.manifestGui?.classList.add("rendered");
}

async function loadListeners({
  renderer,
  pluginManifest,
  withPluginOrInstalled,
  add,
  remove,
  resetToDefaultButton,
}: {
  renderer: ManifestRenderer;
  pluginManifest: Manifest | null;
  withPluginOrInstalled: boolean;
  add: HTMLButtonElement;
  remove: HTMLButtonElement;
  resetToDefaultButton: HTMLButtonElement;
}) {
  function addHandler() {
    writeNewConfig(renderer, "add");
  }
  function removeHandler() {
    writeNewConfig(renderer, "remove");
  }
  function resetToDefaultHandler() {
    handleResetToDefault(renderer, pluginManifest);
  }

  await (async () => {
    getTrackedEventListeners(remove, "click")?.forEach((listener) => {
      removeTrackedEventListener(remove, "click", listener);
    });
    getTrackedEventListeners(add, "click")?.forEach((listener) => {
      removeTrackedEventListener(add, "click", listener);
    });
    getTrackedEventListeners(resetToDefaultButton, "click")?.forEach((listener) => {
      removeTrackedEventListener(resetToDefaultButton, "click", listener);
    });
  })();

  addTrackedEventListener(resetToDefaultButton, "click", resetToDefaultHandler);
  addTrackedEventListener(add, "click", addHandler);
  if (withPluginOrInstalled) {
    addTrackedEventListener(remove, "click", removeHandler);
  }
}
