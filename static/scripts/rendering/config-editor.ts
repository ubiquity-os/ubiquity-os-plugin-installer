import { Manifest, Plugin } from "../../types/plugins";
import { controlButtons } from "./control-buttons";
import { ManifestRenderer } from "../render-manifest";
import { processProperties } from "./input-parsing";
import { updateGuiTitle } from "./utils";
import { writeNewConfig } from "./write-add-remove";
import MarkdownIt from "markdown-it";
import { getManifestCache } from "../../utils/storage";
const md = new MarkdownIt();

export function renderConfigEditor(renderer: ManifestRenderer, pluginManifest: Manifest | null, plugin?: Plugin["uses"][0]["with"]): void {
  renderer.currentStep = "configEditor";
  renderer.backButton.style.display = "block";
  renderer.manifestGuiBody.innerHTML = null;
  controlButtons({ hide: false });
  processProperties(renderer, pluginManifest?.configuration?.properties || {});
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
  if (!add || !remove) {
    throw new Error("Add or remove button not found");
  }
  add.addEventListener("click", writeNewConfig.bind(null, renderer, "add"));

  if (plugin) {
    remove.disabled = false;
    remove.classList.remove("disabled");
    remove.addEventListener("click", () => writeNewConfig.bind(null, renderer, "remove"));
  } else {
    remove.disabled = true;
    remove.classList.add("disabled");
  }

  const resetToDefaultButton = document.getElementById("reset-to-default") as HTMLButtonElement;
  if (!resetToDefaultButton) {
    throw new Error("Reset to default button not found");
  }

  resetToDefaultButton.addEventListener("click", () => {
    renderConfigEditor(renderer, pluginManifest);
    const readmeContainer = document.querySelector(".readme-container");
    if (readmeContainer) {
      readmeContainer.remove();
    }
  });

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
