import { createElement } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { renderOrgSelector } from "./org-select";
import { renderPluginSelector } from "./plugin-select";
import { renderRepoPicker } from "./repo-select";
import { renderTemplateSelector } from "./template-selector";

export type NavSteps = "orgSelector" | "pluginSelector" | "templateSelector" | "configEditor" | "repoSelector" | "templateSelector";

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

export function handleBackButtonClick(renderer: ManifestRenderer): void {
  renderer.manifestGui?.classList.remove("plugin-editor");
  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
  }

  const step = renderer.currentStep;
  if (step === "repoSelector" || step === "orgSelector") {
    renderOrgSelector(renderer, renderer.orgs);
  } else if (step === "templateSelector") {
    renderRepoPicker(renderer, JSON.parse(localStorage.getItem("orgRepos") || "{}"));
  } else if (step === "pluginSelector") {
    renderTemplateSelector(renderer);
  } else if (step === "configEditor") {
    renderPluginSelector(renderer);
  }
}
