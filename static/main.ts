import { ManifestDecoder } from "./scripts/decode-manifest";
import { ManifestRenderer } from "./scripts/render-manifest";

export async function mainModule() {
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
