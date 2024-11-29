import { createElement } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { renderOrgSelector } from "./org-select";
import { renderPluginSelector } from "./plugin-select";

export type NavSteps = "orgSelector" | "pluginSelector" | "templateSelector" | "configEditor";

export function createBackButton(renderer: ManifestRenderer): HTMLButtonElement {
  const backButton = createElement("button", {
    id: "back-button",
    class: "button",
    textContent: "Back",
  }) as HTMLButtonElement;

  backButton.style.display = "none";
  backButton.addEventListener("click", () => handleBackButtonClick(renderer));
  return backButton;
}

function handleBackButtonClick(renderer: ManifestRenderer): void {
  renderer.manifestGui?.classList.remove("plugin-editor");
  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
  }

  const step = renderer.currentStep;

  if (step === "pluginSelector" || step === "orgSelector") {
    renderOrgSelector(renderer, renderer.orgs);
  } else if (step === "configEditor") {
    renderPluginSelector(renderer);
  }
}
