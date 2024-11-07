import { AuthService } from "./scripts/authentication";
import { ManifestDecoder } from "./scripts/decode-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";

async function handleAuth() {
  const auth = new AuthService();
  await auth.renderGithubLoginButton();
  const token = await auth.getGitHubAccessToken();
  if (!token) {
    // await auth.signInWithGithub(); force a login?
  }
}

export async function mainModule() {
  await handleAuth();
  try {
    const decoder = new ManifestDecoder(window.location.search.substring(1));
    const decodedManifest = await decoder.decodeManifest();
    const renderer = new ManifestRenderer(decodedManifest);
    renderer.renderManifest();
  } catch (error) {
    console.error(error);
  }
}

mainModule()
  .then(() => {
    console.log("mainModule loaded");
  })
  .catch((error) => {
    console.error(error);
  });
