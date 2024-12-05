import { createElement } from "../../utils/element-helpers";
import { ManifestRenderer } from "../render-manifest";
import { renderOrgPicker } from "./org-select";
import { renderPluginSelector } from "./plugin-select";
import { renderRepoPicker } from "./repo-select";

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
  //   "pluginSelector" | "configEditor"
  const step = renderer.currentStep;
  if (step === "repoPicker" || step === "orgPicker") {
    renderOrgPicker(renderer, renderer.orgs);
  } else if (step === "pluginSelector") {
    renderRepoPicker(renderer, JSON.parse(localStorage.getItem("orgRepos") || "{}"));
  } else if (step === "configEditor") {
    renderPluginSelector(renderer);
  }
}
