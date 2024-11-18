import { AuthService } from "./scripts/authentication";
import { ManifestDecoder } from "./scripts/decode-manifest";
import { ManifestFetcher } from "./scripts/fetch-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";
import { toastNotification } from "./utils/toaster";

async function handleAuth() {
  const auth = new AuthService();
  await auth.renderGithubLoginButton();
  return auth;
}

export async function mainModule() {
  const auth = await handleAuth();
  const decoder = new ManifestDecoder();
  const renderer = new ManifestRenderer(auth);
  const search = window.location.search.substring(1);

  if (search) {
    const decodedManifest = await decoder.decodeManifestFromSearch(search);
    return renderer.renderManifest(decodedManifest);
  }

  try {
    /**
     * "ubiquity-os", "ubiquity-os-marketplace" === dev config
     * "ubiquity" === prod config
     */
    const ubiquityOrgsToFetchOfficialConfigFrom = ["ubiquity-os"];
    const fetcher = new ManifestFetcher(ubiquityOrgsToFetchOfficialConfigFrom, auth.octokit, decoder);
    const cache = fetcher.checkManifestCache();
    if (auth.isActiveSession()) {
      const userOrgs = await auth.getGitHubUserOrgs();
      renderer.renderOrgPicker(userOrgs);
      if (Object.keys(cache).length === 0) {
        const manifestCache = await fetcher.fetchMarketplaceManifests();
        localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
        // this is going to extract URLs from our official config which we'll inject into `- plugin: ...`
        await fetcher.fetchOfficialPluginConfig();
      }
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
