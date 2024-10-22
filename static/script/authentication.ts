import { createClient, UserMetadata } from "@supabase/supabase-js";

declare const SUPABASE_URL: string; // @DEV: passed in at build time check build/esbuild-build.ts
declare const SUPABASE_ANON_KEY: string; // @DEV: passed in at build time check build/esbuild-build.ts

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const controlsContainer = document.getElementById("controls") as HTMLElement;

function renderErrorInConsole(error: Error, info?: string) {
  if (info) {
    console.error(error);
  } else {
    console.error(info ?? error.message);
  }
  return false;
}

function renderGitHubLoginButton() {
  const authButton = controlsContainer.children[0];
  authButton.id = "github-login-button";
  authButton.innerHTML = "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  authButton.addEventListener("click", () => gitHubLoginButtonHandler());
  controlsContainer.classList.add("ready");
}

async function gitHubLoginButtonHandler(scopes = "public_repo read:org") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes,
    },
  });
  if (error) {
    renderErrorInConsole(error, "Error logging in");
  }
}

async function renderGitHubUserInformation(gitHubUser: UserMetadata) {
  const authenticatedDivElement = document.createElement("div");
  authenticatedDivElement.id = "authenticated";
  authenticatedDivElement.classList.add("user-container");
  const authButton = controlsContainer.children[0];
  authButton.innerHTML = "<span>Log out</span>";

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
  divNameElement.textContent = gitHubUser.preferred_username || gitHubUser.user_name;
  divNameElement.classList.add("full");
  authenticatedDivElement.appendChild(divNameElement);

  authButton.addEventListener("click", async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      renderErrorInConsole(error, "Error logging out");
    }
    window.location.reload();
  });

  controlsContainer.prepend(authenticatedDivElement);
}

(async function main() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    renderGitHubLoginButton();
    return;
  }

  if (user.user_metadata) {
    await renderGitHubUserInformation(user.user_metadata);
  }
  console.trace(user);
})().catch(() => {
  console.log("[ERROR] Auth module");
});
