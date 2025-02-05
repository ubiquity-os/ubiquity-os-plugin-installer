import { Octokit } from "@octokit/rest";
import { CONFIG_FULL_PATH, CONFIG_ORG_REPO, DEV_CONFIG_FULL_PATH } from "@ubiquity-os/plugin-sdk/constants";
import { ManifestPreDecode, PluginConfig } from "../types/plugins";
import YAML from "yaml";

/**
 * Responsible for:
 * - UbiquityOS Marketplace data fetching (`config-parser` fetches user configs)
 * - Fetching the manifest.json files from the marketplace
 * - Fetching the README.md files from the marketplace
 * - Storing the fetched data in localStorage
 * - building the `ManifestCache` from the fetched data
 */
export class ManifestFetcher {
  private _orgs: string[];
  private _octokit: Octokit | null;

  pluginUrls = new Set<string>();

  constructor(orgs: string[], octokit: Octokit | null) {
    this._orgs = orgs;
    this._octokit = octokit;
  }

  /**
   * Setups up our `manifestCache` with the fetched data from the marketplace.
   *
   * Removes entries that caused an error during fetching, typically .github etc
   * as well as nulls any malformed `homepage_url` entries which is
   * used to `disable` the `plugin-select` button in the UI.
   */
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
      if (manifest.error) {
        // naively, repos such as .github, .ubiquity-os
        continue;
      }
      const readme = await this.fetchPluginReadme(this.createGithubRawEndpoint(org, repo.name, "development", "README.md"));
      let homepageUrl = manifest.homepage_url || null;

      if (homepageUrl && !homepageUrl.endsWith("ubiquity.workers.dev") && !homepageUrl.startsWith("ubiquity-os")) {
        console.error("Invalid homepage url", homepageUrl);
        homepageUrl = null;
      }

      if (!homepageUrl) {
        const repoUrls = Array.from(this.pluginUrls);
        for (const url of repoUrls) {
          if (url.includes(repo.name)) {
            homepageUrl = url;
            break;
          }
        }
      }

      // hacky but the issue remains in some plugins
      if (repo.name !== manifest.name) {
        manifest.name = repo.name;
      }

      manifestCache[repo.name] = { manifest, readme, homepageUrl };
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

  createGithubRawEndpoint(owner: string, repo: string, branch: string, path: string) {
    // no endpoint so we fetch the raw content from the owner/repo/branch
    return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}`;
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

  /**
   * Fetches the yaml config from the orgs used when initializing this class.
   *
   * This is used to get the action urls for the plugins and a fallback for worker
   * which may not have `homepage_url` in the manifest.
   */
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
      const configObj = YAML.parse(config) as PluginConfig;
      for (const plugin of configObj.plugins) {
        const pluginUrl = plugin.uses?.[0].plugin; // we only use single chain plugins for now, needs to be updated for multi-chain
        if (!pluginUrl) {
          console.error("No plugin url found in config", {
            plugin,
            configObj,
          });
        } else {
          this.pluginUrls.add(pluginUrl);
        }
      }
    }
  }
}
