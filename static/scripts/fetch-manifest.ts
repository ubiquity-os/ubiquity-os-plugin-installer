import { Octokit } from "@octokit/rest";
import { Manifest, ManifestPreDecode } from "../types/plugins";
import { DEV_CONFIG_FULL_PATH, CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";
import { getOfficialPluginConfig } from "../utils/storage";

/**
 * Responsible for:
 * - Mainly UbiquityOS Marketplace data fetching (config-parser fetches user configs)
 * - Fetching the manifest.json files from the marketplace
 * - Fetching the README.md files from the marketplace
 * - Fetching the official plugin config from the orgs
 * - Capturing the worker and action urls from the official plugin config (will be taken from the manifest directly soon)
 * - Storing the fetched data in localStorage
 */
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

    for (const repo of repos.data) {
      const manifestUrl = this.createGithubRawEndpoint(org, repo.name, "development", "manifest.json");
      const manifest = await this.fetchPluginManifest(manifestUrl);
      const decoded = this.decodeManifestFromFetch(manifest);
      const readme = await this.fetchPluginReadme(this.createGithubRawEndpoint(org, repo.name, "development", "README.md"));

      if (decoded) {
        manifestCache[manifestUrl] = { ...decoded, readme };
      }
    }

    localStorage.setItem("manifestCache", JSON.stringify(manifestCache));
    return manifestCache;
  }

  checkManifestCache(): Record<string, ManifestPreDecode> {
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

  createGithubRawEndpoint(owner: string, repo: string, branch: string, path: string) {
    // no endpoint so we fetch the raw content from the owner/repo/branch
    return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}`;
  }

  captureActionUrls(config: string) {
    let match;
    while ((match = this.actionUrlRegex.exec(config)) !== null) {
      this.actionUrls.add(match[0]);
    }
  }

  async fetchOfficialPluginConfig() {
    await this.fetchOrgsUbiquityOsConfigs();
    const officialPluginConfig = getOfficialPluginConfig();

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

  async fetchPluginManifest(actionUrl: string) {
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

  async fetchPluginReadme(pluginUrl: string) {
    async function handle404(result: string, octokit?: Octokit | null) {
      if (result.includes("404: Not Found")) {
        const [owner, repo] = pluginUrl.split("/").slice(3, 5);
        const readme = await octokit?.repos.getContent({
          owner,
          repo,
          path: "README.md",
        });

        if (readme && "content" in readme.data) {
          return atob(readme.data.content);
        } else {
          return "No README.md found";
        }
      }

      return result;
    }
    try {
      const response = await fetch(pluginUrl, { signal: new AbortController().signal });
      return await handle404(await response.text(), this._octokit);
    } catch (e) {
      let error = e;
      try {
        const res = await fetch(pluginUrl.replace(/development/g, "main"), { signal: new AbortController().signal });
        return await handle404(await res.text(), this._octokit);
      } catch (e) {
        error = e;
      }
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
