import { createClient } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type GitHubUserResponse = RestEndpointMethodTypes["users"]["getByUsername"]["response"];
export type GitHubUser = GitHubUserResponse["data"];

export type TaskStorageItems = {
  timestamp: number; // in milliseconds
  tasks: GitHubIssue[];
  loggedIn: boolean;
};

type RateLimit = {
  reset: number | null;
  user: boolean;
};

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];

export interface AuthToken {
  provider_token: string;
  access_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    aud: string;
    role: string;
    email: string;
    email_confirmed_at: string;
    phone: string;
    confirmed_at: string;
    last_sign_in_at: string;
    app_metadata: { provider: string; providers: string[] };
    user_metadata: {
      avatar_url: string;
      email: string;
      email_verified: boolean;
      full_name: string;
      iss: string;
      name: string;
      phone_verified: boolean;
      preferred_username: string;
      provider_id: string;
      sub: string;
      user_name: string;
    };
    identities: [
      {
        id: string;
        user_id: string;
        identity_data: {
          avatar_url: string;
          email: string;
          email_verified: boolean;
          full_name: string;
          iss: string;
          name: string;
          phone_verified: boolean;
          preferred_username: string;
          provider_id: string;
          sub: string;
          user_name: string;
        };
        provider: string;
        last_sign_in_at: string;
        created_at: string;
        updated_at: string;
      },
    ];
    created_at: string;
    updated_at: string;
  };
}

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

const gitHubLoginButton = document.getElementById("github-sign-in") as HTMLElement;
const authenticationElement = document.getElementById("authenticationElement") as HTMLElement;

export function renderErrorInModal(error: Error, info?: string) {
  if (info) {
    console.error(error);
  } else {
    console.error(info ?? error.message);
  }
  displayPopupMessage({
    modalHeader: error.name,
    modalBody: info ?? error.message,
    isError: true,
  });
  return false;
}

export function displayPopupMessage({ modalHeader, modalBody, isError, url }: { modalHeader: string; modalBody: string; isError: boolean; url?: string }) {
  titleHeader.textContent = modalHeader;
  if (url) {
    titleAnchor.href = url;
  }
  modalBodyInner.innerHTML = modalBody;

  modal.classList.add("active");
  document.body.classList.add("preview-active");

  if (toolbar) {
    toolbar.scrollTo({
      left: toolbar.scrollWidth,
      behavior: "smooth",
    });
  }

  if (isError) {
    modal.classList.add("error");
  } else {
    modal.classList.remove("error");
  }
  console.trace({
    modalHeader,
    modalBody,
    isError,
    url,
  });
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

export async function handleRateLimit(octokit?: Octokit, error?: RequestError) {
  const rate: RateLimit = {
    reset: null,
    user: false,
  };

  modal.classList.add("active");
  document.body.classList.add("preview-active");

  if (toolbar) {
    toolbar.scrollTo({
      left: toolbar.scrollWidth,
      behavior: "smooth",
    });

    gitHubLoginButton?.classList.add("highlight");
  }

  if (error?.response?.headers["x-ratelimit-reset"]) {
    rate.reset = parseInt(error.response.headers["x-ratelimit-reset"]);
  }

  if (octokit) {
    try {
      const core = await octokit.rest.rateLimit.get();
      const remaining = core.data.resources.core.remaining;
      const reset = core.data.resources.core.reset;

      rate.reset = !rate.reset && remaining === 0 ? reset : rate.reset;
      rate.user = !!(await getGitHubUser());
    } catch (err) {
      renderErrorInModal(err as Error, "Error handling GitHub rate limit");
    }
  }

  const resetParsed = rate.reset && new Date(rate.reset * 1000).toLocaleTimeString();

  if (!rate.user) {
    rateLimitModal(`You have been rate limited. Please log in to GitHub to increase your GitHub API limits, otherwise you can try again at ${resetParsed}.`);
  } else {
    rateLimitModal(`You have been rate limited. Please try again at ${resetParsed}.`);
  }
}

export function rateLimitModal(message: string) {
  displayPopupMessage({ modalHeader: `GitHub API rate limit exceeded.`, modalBody: message, isError: false });
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
  const params = new URLSearchParams(hash.substr(1)); // remove the '#' and parse
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
    console.log(response);
    return response.data;
  } catch (error) {
    console.log(error.status);
    if (!!error && typeof error === "object" && "status" in error && error.status === 403) {
      await handleRateLimit(providerToken ? octokit : undefined, error as RequestError);
    }
    console.warn("You have been logged out. Please login again.", error);
  }
  return null;
}

function renderGitHubLoginButton() {
  gitHubLoginButton.id = "github-login-button";
  gitHubLoginButton.innerHTML = "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  gitHubLoginButton.addEventListener("click", () => gitHubLoginButtonHandler());
  if (authenticationElement) {
    authenticationElement.appendChild(gitHubLoginButton);
    authenticationElement.classList.add("ready");
  }
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

async function displayGitHubUserInformation(gitHubUser: GitHubUser) {
  const authenticatedDivElement = document.createElement("div");
  const containerDivElement = document.createElement("div");
  authenticatedDivElement.id = "authenticated";
  authenticatedDivElement.classList.add("user-container");
  if (!toolbar) throw new Error("toolbar not found");

  const img = document.createElement("img");
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

  authenticatedDivElement.addEventListener("click", async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      renderErrorInModal(error, "Error logging out");
      alert("Error logging out");
    }
    window.location.reload();
  });

  containerDivElement.appendChild(authenticatedDivElement);

  authenticationElement.appendChild(containerDivElement);
  toolbar.setAttribute("data-authenticated", "true");
  toolbar.classList.add("ready");
}

async function authentication() {
  const accessToken = await getGitHubAccessToken();
  if (!accessToken) {
    renderGitHubLoginButton();
    return;
  }

  const gitHubUser = await getGitHubUser();
  if (gitHubUser) {
    await displayGitHubUserInformation(gitHubUser);
  }
}

(async function main() {
  void authentication();
})().catch(() => {
  console.log("[ERROR] Auth module");
});
