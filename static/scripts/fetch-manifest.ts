import { Octokit } from "@octokit/rest";
import { ManifestDecoder, ManifestPreDecode } from "./decode-manifest";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO, DEV_CONFIG_FULL_PATH, Manifest } from "@ubiquity-os/ubiquity-os-kernel"

/**
 * Given a list of repositories, fetch the manifest for each repository.
 */
export class ManifestFetcher {
  private _orgs: string[];
  private _octokit: Octokit;
  private _decoder: ManifestDecoder;

  workerUrlRegex = /https:\/\/([a-z0-9-]+)\.ubiquity\.workers\.dev/g;
  actionUrlRegex = /(?<owner>[a-z0-9-]+)\/(?<repo>[a-z0-9-]+)(?:\/[^@]+)?@(?<branch>[a-z0-9-]+)/g;
  workerUrls = new Set<string>();
  actionUrls = new Set<string>();

  constructor(orgs: string[], octokit: Octokit | null, decoder: ManifestDecoder) {
    this._orgs = orgs;
    if (!octokit) {
      throw new Error("Octokit failed to initialize");
    }
    this._octokit = octokit;
    this._decoder = decoder;
  }

  checkManifestCache(): Record<string, ManifestPreDecode> {
    // check if the manifest is already in the cache
    const manifestCache = localStorage.getItem("manifestCache");
    if (manifestCache) {
      return JSON.parse(manifestCache);
    }
    return {};
  }

  captureWorkerUrls(config: string) {
    // take the full url and just ping the endpoint
    let match;
    while ((match = this.workerUrlRegex.exec(config)) !== null) {
      const workerUrl = match[0];
      this.workerUrls.add(workerUrl);
    }
  }

  createActionEndpoint(owner: string, repo: string, branch: string) {
    // no endpoint so we fetch the raw content from the owner/repo/branch
    return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/manifest.json`;
  }

  captureActionUrls(config: string) {
    let match;
    while ((match = this.actionUrlRegex.exec(config)) !== null) {
      const { owner, repo, branch } = match.groups || {};
      if (owner && repo && branch) {
        const endpoint = this.createActionEndpoint(owner, repo, branch);
        this.actionUrls.add(endpoint);
      }
    }
  }

  sanitizeManifestCache(manifestCache: Record<string, ManifestPreDecode>) {
    for (const key of Object.keys(manifestCache)) {
      if (manifestCache[key]?.error) {
        console.log("Removing error manifest", manifestCache[key]);
        delete manifestCache[key];
      }
    }

    return manifestCache;
  }

  async fetchManifests() {
    const manifestCache = this.checkManifestCache();

    if (Object.keys(manifestCache).length > 0) {
      return this.sanitizeManifestCache(manifestCache);
    }

    console.log("Fetching manifests...");
    await this.fetchOrgsUbiquityOsConfigs();
    console.log("Worker URLs", this.workerUrls);
    console.log("Action URLs", this.actionUrls);

    for (const workerUrl of this.workerUrls) {
      if (manifestCache[workerUrl]) {
        continue;
      }

      const manifest = await this.fetchWorkerManifest(workerUrl);
      manifestCache[workerUrl] = this._decoder.decodeManifestFromFetch(manifest);
    }

    for (const actionUrl of this.actionUrls) {
      if (manifestCache[actionUrl]) {
        continue;
      }

      const manifest = await this.fetchActionManifest(actionUrl);
      manifestCache[actionUrl] = this._decoder.decodeManifestFromFetch(manifest);
    }

    this.sanitizeManifestCache(manifestCache);

    localStorage.setItem("manifestCache", JSON.stringify(manifestCache));

    return manifestCache;
  }

  async fetchWorkerManifest(workerUrl: string) {
    try {
      const response = await fetch(workerUrl + "/manifest.json", {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });
      return await response.json();
    } catch (e) {
      if (e instanceof Error) {
        return { workerUrl, error: e.message };
      }
      console.error(e);
      return { workerUrl, error: String(e) };
    }
  }

  async fetchActionManifest(actionUrl: string) {
    try {
      const response = await fetch(actionUrl);
      return await response.json();
    } catch (e) {
      if (e instanceof Error) {
        return { actionUrl, error: e.message };
      }
      console.error(e);
      return { actionUrl, error: String(e) };
    }
  }

  async fetchOrgsUbiquityOsConfigs() {
    const configFileContents: Record<string, string> = {};


    for (const org of this._orgs) {
      try {
        const { data: devConfig } = await this._octokit.repos.getContent({
          owner: org,
          repo: CONFIG_ORG_REPO,
          path: DEV_CONFIG_FULL_PATH,
        });

        if ("content" in devConfig) {
          configFileContents[`${org}-dev`] = atob(devConfig.content);
        }
      } catch (e) {
        console.log(e);
      }

      try {
        const { data: prodConfig } = await this._octokit.repos.getContent({
          owner: org,
          repo: CONFIG_ORG_REPO,
          path: CONFIG_FULL_PATH,
        });

        if ("content" in prodConfig) {
          configFileContents[`${org}-prod`] = atob(prodConfig.content);
        }
      } catch (e) {
        console.log(e);
      }
    }

    for (const config of Object.values(configFileContents)) {
      this.captureWorkerUrls(config);
      this.captureActionUrls(config);
    }
  }
}
