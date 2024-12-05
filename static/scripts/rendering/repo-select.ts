import { createElement } from "../../utils/element-helpers";
import { STRINGS } from "../../utils/strings";
import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { controlButtons } from "./control-buttons";
import { renderPluginSelector } from "./plugin-select";
import { updateGuiTitle } from "./utils";

export function renderRepoPicker(renderer: ManifestRenderer, repos: Record<string, string[]>): void {
  renderer.currentStep = "repoPicker";
  controlButtons({ hide: true });
  renderer.backButton.style.display = "block";
  renderer.manifestGui?.classList.add("rendering");
  renderer.manifestGuiBody.innerHTML = null;

  if (!Reflect.ownKeys(repos).length) {
    updateGuiTitle("No repositories found");
    renderer.manifestGuiBody.appendChild(document.createElement("tr"));
    renderer.manifestGui?.classList.add("rendered");
    return;
  }

  localStorage.setItem("orgRepos", JSON.stringify(repos));

  const selectedOrg = localStorage.getItem("selectedOrg");

  if (!selectedOrg) {
    throw new Error(`No selected org found in local storage`);
  }

  const topLevelRow = document.createElement("tr");
  const topLevelCell = document.createElement("td");
  topLevelCell.colSpan = 4;
  topLevelCell.className = STRINGS.TDV_CENTERED;

  const useOrgConfigButton = createElement("button", {
    id: "use-org-config-button",
    textContent: `Use ${selectedOrg} config`,
  });

  useOrgConfigButton.style.width = "100%";
  useOrgConfigButton.style.textAlign = "left";

  useOrgConfigButton.addEventListener("click", () => {
    localStorage.setItem("selectedRepo", selectedOrg);
    fetchOrgConfig(renderer, selectedOrg, selectedOrg)
      .then(() => {
        renderPluginSelector(renderer);
      })
      .catch((error) => {
        console.error(error);
        toastNotification("Error fetching org config", { type: "error" });
      });
  });

  topLevelCell.appendChild(useOrgConfigButton);
  topLevelRow.appendChild(topLevelCell);
  renderer.manifestGuiBody.appendChild(topLevelRow);

  const pickerRow = document.createElement("tr");
  const pickerCell = document.createElement("td");
  pickerCell.colSpan = 4;
  pickerCell.className = STRINGS.TDV_CENTERED;

  updateGuiTitle("Select a Repository");

  const repoSelect = createElement("select", {
    id: "repo-picker-select",
    class: STRINGS.PICKER_SELECT,
    style: "width: 100%",
  });

  const defaultOption = createElement("option", {
    value: null,
    textContent: "Or select a repository...",
  });
  repoSelect.appendChild(defaultOption);

  const orgRepos = repos[selectedOrg];

  if (!orgRepos) {
    throw new Error("No org repos found");
  }

  orgRepos.forEach((repo) => {
    const option = createElement("option", {
      value: repo,
      textContent: repo,
    });
    repoSelect.appendChild(option);
  });

  repoSelect.addEventListener("change", (event) => handleRepoSelection(event, renderer));
  pickerCell.appendChild(repoSelect);
  pickerRow.appendChild(pickerCell);
  renderer.manifestGuiBody.appendChild(pickerRow);

  renderer.manifestGui?.classList.add("rendered");
}

async function fetchOrgConfig(renderer: ManifestRenderer, org: string, repo: string): Promise<void> {
  const kill = toastNotification(`Fetching ${org} config...`, { type: "info", shouldAutoDismiss: true });
  const octokit = renderer.auth.octokit;
  if (!octokit) {
    throw new Error("No org or octokit found");
  }
  await renderer.configParser.fetchUserInstalledConfig(org, octokit, repo);
  kill();
}

function handleRepoSelection(event: Event, renderer: ManifestRenderer): void {
  const selectElement = event.target as HTMLSelectElement;
  const selectedRepo = selectElement.value;
  if (selectedRepo) {
    localStorage.setItem("selectedRepo", selectedRepo);
    const selectedOrg = localStorage.getItem("selectedOrg");
    if (!selectedOrg) {
      throw new Error("No selected org found");
    }

    fetchOrgConfig(renderer, selectedOrg, selectedRepo)
      .then(() => {
        renderPluginSelector(renderer);
      })
      .catch((error) => {
        console.error(error);
        toastNotification("Error fetching org config", { type: "error" });
      });
  }
}
