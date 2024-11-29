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
    const ubiquityOrgsToFetchOfficialConfigFrom = ["ubiquity-os"];
    const fetcher = new ManifestFetcher(ubiquityOrgsToFetchOfficialConfigFrom, auth.octokit);
    const cache = fetcher.checkManifestCache();

    if (auth.isActiveSession()) {
      const userOrgs = await auth.getGitHubUserOrgs();

      if (Object.keys(cache).length === 0) {
        renderer.manifestGuiBody.dataset.loading = "true";
        const killNotification = toastNotification("Fetching manifest data...", { type: "info", shouldAutoDismiss: true });
        renderOrgSelector(renderer, []);

        await fetcher.fetchMarketplaceManifests();
        await fetcher.fetchOfficialPluginConfig();
        killNotification();
        renderer.manifestGuiBody.dataset.loading = "false";
      }

      renderOrgSelector(renderer, userOrgs);
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
