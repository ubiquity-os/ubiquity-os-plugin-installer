import { ManifestPreDecode } from "../../types/plugins";
import { createElement } from "../../utils/element-helpers";
import { STRINGS } from "../../utils/strings";
import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { controlButtons } from "./control-buttons";
import { renderPluginSelector } from "./plugin-select";
import { closeAllSelect, updateGuiTitle } from "./utils";

export function renderOrgPicker(renderer: ManifestRenderer, orgs: string[], fetchPromise?: Promise<Record<string, ManifestPreDecode>>) {
  renderer.currentStep = "orgPicker";
  controlButtons({ hide: true });
  renderer.backButton.style.display = "none";
  renderer.manifestGui?.classList.add("rendering");
  renderer.manifestGuiBody.innerHTML = null;

  const pickerRow = document.createElement("tr");
  const pickerCell = document.createElement("td");
  pickerCell.colSpan = 4;
  pickerCell.className = STRINGS.TDV_CENTERED;

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

  renderer.manifestGuiBody.appendChild(pickerRow);
  renderer.manifestGui?.classList.add("rendered");

  if (!orgs.length) {
    const hasSession = renderer.auth.isActiveSession();
    if (hasSession) {
      updateGuiTitle("No organizations found");
    } else {
      updateGuiTitle("Please sign in to GitHub");
    }
    return;
  }

  updateGuiTitle("Select an Organization");

  orgs.forEach((org) => {
    const optionDiv = createElement("div", { class: "select-option" });
    const textSpan = createElement("span", { textContent: org });

    optionDiv.appendChild(textSpan);

    optionDiv.addEventListener("click", () => {
      handleOrgSelection(renderer, org, fetchPromise);
      selectSelected.textContent = org;
      localStorage.setItem("selectedOrg", org);
    });

    selectItems.appendChild(optionDiv);
  });

  selectSelected.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllSelect();
    selectItems.classList.toggle(STRINGS.SELECT_HIDE);
    selectSelected.classList.toggle(STRINGS.SELECT_ARROW_ACTIVE);
  });

  document.addEventListener("click", closeAllSelect);
}

function handleOrgSelection(renderer: ManifestRenderer, org: string, fetchPromise?: Promise<Record<string, ManifestPreDecode>>): void {
  if (!org) {
    throw new Error("No org selected");
  }

  localStorage.setItem("selectedOrg", org);

  if (fetchPromise) {
    fetchPromise
      .then((manifestCache) => {
        localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
      })
      .catch((error) => {
        console.error("Error fetching manifest cache:", error);
        toastNotification(`An error occurred while fetching the manifest cache: ${String(error)}`, {
          type: "error",
          shouldAutoDismiss: true,
        });
      });

    const fetchOrgConfig = async () => {
      const octokit = renderer.auth.octokit;
      if (!octokit) {
        throw new Error("No org or octokit found");
      }
      await renderer.configParser.fetchUserInstalledConfig(org, octokit);
      renderPluginSelector(renderer);
    };
    fetchOrgConfig().catch(console.error);
  } else {
    renderPluginSelector(renderer);
  }
}
