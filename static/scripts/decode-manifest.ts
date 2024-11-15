import { Manifest, ManifestPreDecode } from "../types/plugins";

export class ManifestDecoder {
  constructor() {}

  decodeManifestFromFetch(manifest: ManifestPreDecode) {
    if (manifest.error) {
      return null;
    }

    const decodedManifest: Manifest = {
      name: manifest.name,
      description: manifest.description,
      "ubiquity:listeners": manifest["ubiquity:listeners"],
      configuration: manifest.configuration,
    };

    return decodedManifest;
  }

  decodeManifestFromSearch(search: string) {
    const parsed = this.stringUriParser(search);

    const encodedManifestEnvelope = parsed.find((pair) => pair["manifest"]);
    if (!encodedManifestEnvelope) {
      throw new Error("No encoded manifest found!");
    }
    const encodedManifest = encodedManifestEnvelope["manifest"];
    const decodedManifest = decodeURI(encodedManifest);

    this.renderManifest(decodedManifest);
    return JSON.parse(decodedManifest);
  }

  stringUriParser(input: string): Array<{ [key: string]: string }> {
    const buffer: Array<{ [key: string]: string }> = [];
    const sections = input.split("&");
    for (const section of sections) {
      const keyValues = section.split("=");
      buffer.push({ [keyValues[0]]: keyValues[1] });
    }
    return buffer;
  }

  renderManifest(manifest: string) {
    const dfg = document.createDocumentFragment();
    dfg.textContent = manifest;
  }
}
