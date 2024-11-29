import { createElement } from "../../utils/element-helpers";
import { STRINGS } from "../../utils/strings";
import { ManifestRenderer } from "../render-manifest";
import { controlButtons } from "./control-buttons";
import { renderTemplateSelector } from "./template-selector";
import { closeAllSelect, updateGuiTitle } from "./utils";

/**
 * Renders the orgs for the authenticated user to select from.
 */
export function renderOrgPicker(renderer: ManifestRenderer, orgs: string[]) {
  renderer.currentStep = "orgSelector";
  controlButtons({ hide: true });
  renderer.backButton.style.display = "none";
  renderer.manifestGui?.classList.add("rendering");
  renderer.manifestGuiBody.innerHTML = null;
  renderer.orgs = orgs;

  const pickerRow = document.createElement("tr");
  const pickerCell = document.createElement("td");
  pickerCell.colSpan = 4;
  pickerCell.className = STRINGS.TDV_CENTERED;

  const customSelect = createElement("div", { class: "custom-select", style: `display: ${orgs.length ? "block" : "none"}` });

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
    const isLoading = renderer.manifestGuiBody.dataset.loading === "true";

    if (hasSession && !isLoading) {
      updateGuiTitle("No organizations found");
    } else if (hasSession && isLoading) {
      updateGuiTitle("Fetching organization data...");
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
      selectSelected.textContent = org;
      handleOrgSelection(renderer, org);
    });

    selectItems.appendChild(optionDiv);
  });

  selectSelected.addEventListener("click", (e) => {
    e.stopPropagation();
    selectItems.classList.toggle(STRINGS.SELECT_HIDE);
    selectSelected.classList.toggle(STRINGS.SELECT_ARROW_ACTIVE);
  });

  document.addEventListener("click", closeAllSelect);
}

function handleOrgSelection(renderer: ManifestRenderer, org: string): void {
  if (!org) {
    throw new Error("No org selected");
  }
  localStorage.setItem("selectedOrg", org);
  renderTemplateSelector(renderer);
}
