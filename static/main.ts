import { AuthService } from "./scripts/authentication";
import { ManifestDecoder } from "./scripts/decode-manifest";
import { ManifestFetcher } from "./scripts/fetch-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";

async function handleAuth() {
  const auth = new AuthService();
  await auth.renderGithubLoginButton();
  const token = await auth.getGitHubAccessToken();
  if (!token) {
    // await auth.signInWithGithub(); force a login?
  }

  return auth
}

export async function mainModule() {
  const auth = await handleAuth();
  const decoder = new ManifestDecoder();
  const renderer = new ManifestRenderer();
  const search = window.location.search.substring(1);

  if (search) {
    const decodedManifest = await decoder.decodeManifestFromSearch(search);
    return renderer.renderManifest(decodedManifest);
  }

  try {
    const userOrgs = await auth.getGitHubUserOrgs();
    renderer.renderOrgPicker(userOrgs);
  } catch (error) {
    console.error(error);
    // if (error instanceof Error) {
    //   const message = error.message;
    //   if (message === "No encoded manifest found!") {
    //     const fetcher = new ManifestFetcher(["ubiquity-os"], auth.octokit, decoder);
    //     const manifestCache = await fetcher.fetchManifests();
    //     const firstErrorlessManifest = Object.values(manifestCache).find((manifest) => !manifest.error);
    //     if (!firstErrorlessManifest) {
    //       throw new Error("No errorless manifests found!");
    //     }
    //     renderer.renderManifest(firstErrorlessManifest);
    //   }
    // }
  }
}

mainModule()
  .then(() => {
    console.log("mainModule loaded");
  })
  .catch((error) => {
    console.error(error);
  });
