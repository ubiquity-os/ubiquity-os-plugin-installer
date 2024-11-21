import { createElement } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { renderOrgPicker } from "./org-select";
import { renderPluginSelector } from "./plugin-select";

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
  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
    renderer.manifestGuiBody?.classList.remove("plugin-editor");
  }

  const step = renderer.currentStep;

  if (step === "pluginSelector" || step === "orgPicker") {
    renderOrgPicker(renderer, renderer.orgs);
  } else if (step === "configEditor") {
    renderPluginSelector(renderer);
  }
}
