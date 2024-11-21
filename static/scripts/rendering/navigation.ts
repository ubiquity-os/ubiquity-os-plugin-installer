import { createElement, manifestGuiBody } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { renderOrgPicker } from "./org-select";
import { renderPluginSelector } from "./plugin-select";

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
    renderOrgPicker(renderer, renderer.orgs);
  } else if (step === "configEditor") {
    renderPluginSelector(renderer);
  }

  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
    manifestGuiBody?.classList.remove("plugin-editor");
  }
}
