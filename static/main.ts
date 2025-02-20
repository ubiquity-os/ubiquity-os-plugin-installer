import { AuthService } from "./scripts/authentication";
import { ManifestFetcher } from "./scripts/fetch-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";
import { renderOrgSelector } from "./scripts/rendering/org-select";
import { toastNotification } from "./utils/toaster";

async function handleAuth() {
  const auth = new AuthService();
  await auth.renderGithubLoginButton();
  return auth;
}

export async function mainModule() {
  const auth = await handleAuth();
  const renderer = new ManifestRenderer(auth);
  renderer.manifestGuiBody.dataset.loading = "false";

  try {
    // needs handled better
    const ubiquityOrgsToFetchOfficialConfigFrom = ["ubiquity-os"];
    const fetcher = new ManifestFetcher(ubiquityOrgsToFetchOfficialConfigFrom, auth.octokit);

    if (auth.isActiveSession()) {
      renderer.manifestGuiBody.dataset.loading = "true";
      const killNotification = toastNotification("Fetching manifest data...", { type: "info", shouldAutoDismiss: true });
      const userOrgs = await auth.getGitHubUserOrgs();

      const userOrgRepos = await auth.getGitHubUserOrgRepos(userOrgs);
      localStorage.setItem("orgRepos", JSON.stringify(userOrgRepos));
      renderOrgSelector(renderer, userOrgs);

      await fetcher.fetchOrgsUbiquityOsConfigs();
      await fetcher.fetchMarketplaceManifests();
      renderer.manifestGuiBody.dataset.loading = "false";
      killNotification();
    } else {
      renderOrgSelector(renderer, []);
    }
  } catch (error) {
    if (error instanceof Error) {
      toastNotification(error.message, { type: "error" });
    } else {
      toastNotification(String(error), { type: "error" });
    }
  }
}

mainModule().catch(console.error);
