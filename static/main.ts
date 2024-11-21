import { AuthService } from "./scripts/authentication";
import { ManifestFetcher } from "./scripts/fetch-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";
import { ManifestPreDecode } from "./types/plugins";
import { manifestGuiBody } from "./utils/element-helpers";
import { toastNotification } from "./utils/toaster";

async function handleAuth() {
  const auth = new AuthService();
  await auth.renderGithubLoginButton();
  return auth;
}

export async function mainModule() {
  const auth = await handleAuth();
  const renderer = new ManifestRenderer(auth);

  try {
    const ubiquityOrgsToFetchOfficialConfigFrom = ["ubiquity-os"];
    const fetcher = new ManifestFetcher(ubiquityOrgsToFetchOfficialConfigFrom, auth.octokit);
    const cache = fetcher.checkManifestCache();
    if (!manifestGuiBody) {
      throw new Error("Manifest GUI body not found");
    }
    manifestGuiBody.dataset.loading = "false";

    if (auth.isActiveSession()) {
      const userOrgs = await auth.getGitHubUserOrgs();
      let fetchPromise: Promise<Record<string, ManifestPreDecode>> = Promise.resolve(cache);
      if (Object.keys(cache).length === 0) {
        const killNotification = toastNotification("Fetching manifest data...", { type: "info", shouldAutoDismiss: true });
        manifestGuiBody.dataset.loading = "true";

        // eslint-disable-next-line no-async-promise-executor
        fetchPromise = new Promise(async (resolve) => {
          if (!manifestGuiBody) {
            throw new Error("Manifest GUI body not found");
          }
          const manifestCache = await fetcher.fetchMarketplaceManifests();
          localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
          await fetcher.fetchOfficialPluginConfig();
          manifestGuiBody.dataset.loading = "false";
          resolve(manifestCache);
          killNotification();
        });
      }

      renderer.renderOrgPicker(userOrgs, fetchPromise);
    } else {
      renderer.renderOrgPicker([]);
    }
  } catch (error) {
    if (error instanceof Error) {
      toastNotification(error.message, { type: "error" });
    } else {
      toastNotification(String(error), { type: "error" });
    }
  }
}

mainModule()
  .then(() => {
    console.log("mainModule loaded");
  })
  .catch((error) => {
    console.error(error);
  });
