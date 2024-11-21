import { createElement, manifestGuiBody } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";

export function createBackButton(renderer: ManifestRenderer, step: string): HTMLButtonElement {
  const backButton = createElement("button", {
    id: "back-button",
    class: "button",
    textContent: "Back",
  }) as HTMLButtonElement;

  backButton.style.display = "none";
  backButton.addEventListener("click", handleBackButtonClick.bind(null, renderer, step));
  return backButton;
}

function handleBackButtonClick(renderer: ManifestRenderer, step: string): void {
  if (step === "pluginSelector") {
    renderer.renderOrgPicker(renderer.orgs);
  } else if (step === "configEditor") {
    renderer.renderPluginSelector();
  }

  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
    manifestGuiBody?.classList.remove("plugin-editor");
  }
}
