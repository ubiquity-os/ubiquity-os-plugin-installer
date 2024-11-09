import { Octokit } from "@octokit/rest";
import { ManifestDecoder } from "./decode-manifest";
import { ManifestPreDecode } from "../types/plugins";

/**
 * Given a list of repositories, fetch the manifest for each repository.
 */
export class ManifestFetcher {
  private _orgs: string[];
  private _octokit: Octokit | null;
  private _decoder: ManifestDecoder;

  workerUrlRegex = /https:\/\/([a-z0-9-]+)\.ubiquity\.workers\.dev/g;
  actionUrlRegex = /(?<owner>[a-z0-9-]+)\/(?<repo>[a-z0-9-]+)(?:\/[^@]+)?@(?<branch>[a-z0-9-]+)/g;
  workerUrls = new Set<string>();
  actionUrls = new Set<string>();

  devYmlConfigPath = ".github/.ubiquity-os.config.dev.yml";
  prodYmlConfigPath = ".github/.ubiquity-os.config.yml";
  configRepo = ".ubiquity-os";

  constructor(orgs: string[], octokit: Octokit | null, decoder: ManifestDecoder) {
    this._orgs = orgs;
    this._octokit = octokit;
    this._decoder = decoder;
  }

  async fetchMarketplaceManifests() {
    const org = "ubiquity-os-marketplace";
    if (!this._octokit) {
      throw new Error("Octokit not initialized");
    }
    const repos = await this._octokit.repos.listForOrg({ org });
    const manifestCache = this.checkManifestCache();

    for (const repo of repos.data) {
      const manifestUrl = `https://raw.githubusercontent.com/${org}/${repo.name}/development/manifest.json`;
      const manifest = await this.fetchActionManifest(manifestUrl);
      const decoded = this._decoder.decodeManifestFromFetch(manifest);

      if (decoded) {
        manifestCache[manifestUrl] = decoded;
      }
    }

    localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
    return manifestCache;
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

  async fetchManifests() {
    const manifestCache = this.checkManifestCache();

    if (Object.keys(manifestCache).length > 0) {
      return manifestCache;
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
      const decoded = this._decoder.decodeManifestFromFetch(manifest);
      if (decoded) {
        manifestCache[workerUrl] = decoded;
      }
    }

    for (const actionUrl of this.actionUrls) {
      if (manifestCache[actionUrl]) {
        continue;
      }

      const manifest = await this.fetchActionManifest(actionUrl);
      const decoded = this._decoder.decodeManifestFromFetch(manifest);
      if (decoded) {
        manifestCache[actionUrl] = decoded;
      }
    }

    localStorage.setItem("manifestCache", JSON.stringify(manifestCache));

    return manifestCache;
  }

  async fetchWorkerManifest(workerUrl: string) {
    const url = workerUrl + "/manifest.json";
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });
      return await response.json();
    } catch (e) {
      let error = e;
      try {
        console.log("retry fetch with main", url.replace(/development/g, "main"));
        const res = await fetch(url.replace(/development/g, "main"));
        return await res.json();
      } catch (e) {
        error = e;
      }
      console.error(error);
      if (error instanceof Error) {
        return { workerUrl, error: error.message };
      }
      return { workerUrl, error: String(error) };
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

    if (!this._octokit) {
      throw new Error("Octokit not initialized");
    }

    for (const org of this._orgs) {
      try {
        const { data: devConfig } = await this._octokit.repos.getContent({
          owner: org,
          repo: this.configRepo,
          path: this.devYmlConfigPath,
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
          repo: this.configRepo,
          path: this.prodYmlConfigPath,
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
