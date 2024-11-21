import { Octokit } from "@octokit/rest";
import { Manifest, ManifestPreDecode } from "../types/plugins";
import { DEV_CONFIG_FULL_PATH, CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";

export class ManifestFetcher {
  private _orgs: string[];
  private _octokit: Octokit | null;

  workerUrlRegex = /https:\/\/([a-z0-9-]+)\.ubiquity\.workers\.dev/g;
  actionUrlRegex = /[a-z0-9-]+\/[a-z0-9-]+(?:\/[^@]+)?@[a-z0-9-]+/g;
  workerUrls = new Set<string>();
  actionUrls = new Set<string>();

  constructor(orgs: string[], octokit: Octokit | null) {
    this._orgs = orgs;
    this._octokit = octokit;
  }

  async fetchMarketplaceManifests() {
    const org = "ubiquity-os-marketplace";
    if (!this._octokit) {
      throw new Error("Octokit not initialized");
    }
    const repos = await this._octokit.repos.listForOrg({ org });
    const manifestCache = this.checkManifestCache();
    function makeUrl(org: string, repo: string, file: string) { return `https://raw.githubusercontent.com/${org}/${repo}/development/${file}` };

    for (const repo of repos.data) {
      const manifestUrl = makeUrl(org, repo.name, "manifest.json");
      const manifest = await this.fetchActionManifest(manifestUrl);
      const decoded = this.decodeManifestFromFetch(manifest);
      const readme = await this._fetchPluginReadme(makeUrl(org, repo.name, "README.md"));

      if (decoded) {
        manifestCache[manifestUrl] = { ...decoded, readme };
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
      this.actionUrls.add(match[0]);
    }
  }

  async fetchOfficialPluginConfig() {
    await this.fetchOrgsUbiquityOsConfigs();
    const officialPluginConfig = JSON.parse(localStorage.getItem("officialPluginConfig") || "{}") || {};

    this.workerUrls.forEach((url) => {
      officialPluginConfig[url] = { workerUrl: url };
    });

    this.actionUrls.forEach((url) => {
      if (url.includes("ubiquibot")) {
        return;
      }
      officialPluginConfig[url] = { actionUrl: url };
    });

    localStorage.setItem("officialPluginConfig", JSON.stringify(officialPluginConfig));
    return officialPluginConfig;
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

  private async _fetchPluginReadme(pluginUrl: string) {
    try {
      const response = await fetch(pluginUrl, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });
      return await response.text();
    } catch (e) {
      let error = e;
      try {
        const res = await fetch(pluginUrl.replace(/development/g, "main"));
        return await res.text();
      } catch (e) {
        error = e;
      }
      console.error(error);
      if (error instanceof Error) {
        return error.message;
      }
      return String(error);
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

}
