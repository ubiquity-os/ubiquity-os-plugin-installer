import { createClient } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";
import { AuthToken, GitHubUser, GitHubUserResponse, TaskStorageItems } from "./types";

export function generateSupabaseStorageKey(): string | null {
  if (!SUPABASE_URL) {
    console.error("SUPABASE_URL environment variable is not set");
    return null;
  }

  const urlParts = SUPABASE_URL.split(".");
  if (urlParts.length === 0) {
    console.error("Invalid SUPABASE_URL environment variable");
    return null;
  }

  const domain = urlParts[0];
  const lastSlashIndex = domain.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    console.error("Invalid SUPABASE_URL format");
    return null;
  }

  return domain.substring(lastSlashIndex + 1);
}

const SUPABASE_URL = "https://wfzpewmlyiozupulbuur.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmenBld21seWlvenVwdWxidXVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTU2NzQzMzksImV4cCI6MjAxMTI1MDMzOX0.SKIL3Q0NOBaMehH0ekFspwgcu3afp3Dl9EDzPqs1nKs";
const NODE_ENV = "test";
const SUPABASE_STORAGE_KEY = generateSupabaseStorageKey();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const controlsContainer = document.getElementById("controls") as HTMLElement;

export function renderErrorInModal(error: Error, info?: string) {
  if (info) {
    console.error(error);
  } else {
    console.error(info ?? error.message);
  }
  return false;
}

async function getGitHubUser() {
  const activeSessionToken = await getSessionToken();
  return getNewGitHubUser(activeSessionToken);
}

export function getLocalStore(key: string): TaskStorageItems | AuthToken | null {
  const cachedIssues = localStorage.getItem(key);
  if (cachedIssues) {
    try {
      return JSON.parse(cachedIssues); // as OAuthToken;
    } catch (error) {
      renderErrorInModal(error as Error, "Failed to parse cached issues from local storage");
    }
  }
  return null;
}

export function setLocalStore(key: string, value: TaskStorageItems | AuthToken) {
  // remove state from issues before saving to local storage
  localStorage[key] = JSON.stringify(value);
}

async function getSessionToken(): Promise<string | null> {
  const cachedSessionToken = getLocalStore(`sb-${SUPABASE_STORAGE_KEY}-auth-token`) as AuthToken | null;
  if (cachedSessionToken) {
    return cachedSessionToken.provider_token;
  }
  const newSessionToken = await getNewSessionToken();
  if (newSessionToken) {
    return newSessionToken;
  }
  return null;
}

async function getNewSessionToken(): Promise<string | null> {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substr(1));
  const providerToken = params.get("provider_token");
  if (!providerToken) {
    const error = params.get("error_description");
    // supabase auth provider has failed for some reason
    console.error(`GitHub login provider: ${error}`);
  }
  return providerToken || null;
}

async function getNewGitHubUser(providerToken: string | null): Promise<GitHubUser | null> {
  const octokit = new Octokit({ auth: providerToken });
  try {
    const response = (await octokit.request("GET /user")) as GitHubUserResponse;
    return response.data;
  } catch (error) {
    // TODO Rate limit
    if (!!error && typeof error === "object" && "status" in error && error.status === 403) {
      console.log("TODO Rate limit");
    }
    console.warn("You have been logged out. Please login again.", error);
  }
  return null;
}

function renderGitHubLoginButton() {
  const authButton = controlsContainer.children[0];
  authButton.id = "github-login-button";
  authButton.innerHTML = "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  authButton.addEventListener("click", () => gitHubLoginButtonHandler());
  controlsContainer.classList.add("ready");
}

async function gitHubLoginButtonHandler(scopes = "public_repo read:org") {
  const redirectTo = window.location.href;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes,
      redirectTo,
    },
  });
  if (error) {
    renderErrorInModal(error, "Error logging in");
  }
}

async function checkSupabaseSession() {
  // In testing mode, we directly read the storage since we cannot use Supabase for auth operations
  if (NODE_ENV === "test") {
    const stored = localStorage.getItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
    if (!stored) return null;
    return JSON.parse(stored);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

async function getGitHubAccessToken() {
  // better to use official function, looking up localstorage has flaws
  const oauthToken = await checkSupabaseSession();

  const expiresAt = oauthToken?.expires_at;
  if (expiresAt && expiresAt < Date.now() / 1000) {
    localStorage.removeItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
    return null;
  }

  const accessToken = oauthToken?.provider_token;
  if (accessToken) {
    return accessToken;
  }

  return null;
}

async function renderGitHubUserInformation(gitHubUser: GitHubUser) {
  const authenticatedDivElement = document.createElement("div");
  authenticatedDivElement.id = "authenticated";
  authenticatedDivElement.classList.add("user-container");
  const authButton = controlsContainer.children[0];
  authButton.innerHTML = "Log out";
  if (!toolbar) throw new Error("toolbar not found");

  const img = document.createElement("img");
  img.id = "user__avatar";

  if (gitHubUser.avatar_url) {
    img.src = gitHubUser.avatar_url;
  } else {
    img.classList.add("github-avatar-default");
  }
  img.alt = gitHubUser.login;
  authenticatedDivElement.appendChild(img);

  const divNameElement = document.createElement("div");

  // Falls back to login because the name is not required for a GitHub user
  divNameElement.textContent = gitHubUser.name || gitHubUser.login;
  divNameElement.classList.add("full");
  authenticatedDivElement.appendChild(divNameElement);

  authButton.addEventListener("click", async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      renderErrorInModal(error, "Error logging out");
      alert("Error logging out");
    }
    window.location.reload();
  });

  controlsContainer.prepend(authenticatedDivElement);
}

(async function main() {
  const accessToken = await getGitHubAccessToken();
  console.log(accessToken);
  if (!accessToken) {
    renderGitHubLoginButton();
    return;
  }

  const gitHubUser = await getGitHubUser();
  if (gitHubUser) {
    await renderGitHubUserInformation(gitHubUser);
  }
})().catch(() => {
  console.log("[ERROR] Auth module");
});
