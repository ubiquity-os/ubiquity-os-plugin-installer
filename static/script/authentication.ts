async function getGitHubUser() {
  const activeSessionToken = await getSessionToken();
  return getNewGitHubUser(activeSessionToken);
}

async function getGitHubUser() {
  const activeSessionToken = await getSessionToken();
  return getNewGitHubUser(activeSessionToken);
}

function renderGitHubLoginButton() {
  gitHubLoginButton.id = "github-login-button";
  gitHubLoginButton.innerHTML =
    "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  gitHubLoginButton.addEventListener("click", () => gitHubLoginButtonHandler());
  if (authenticationElement) {
    authenticationElement.appendChild(gitHubLoginButton);
    authenticationElement.classList.add("ready");
  }
}

async function gitHubLoginButtonHandler(scopes = "public_repo read:org") {
  let redirectTo = window.location.href;
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
//   if (NODE_ENV === "test") {
//     const stored = localStorage.getItem(
//       `sb-${SUPABASE_STORAGE_KEY}-auth-token`
//     );
//     if (!stored) return null;
//     return JSON.parse(stored);
//   }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

async function getGitHubAccessToken() {
  // better to use official function, looking up localstorage has flaws
  const oauthToken = await checkSupabaseSession();

  const expiresAt = oauthToken?.expires_at;
  if (expiresAt) {
    if (expiresAt < Date.now() / 1000) {
      localStorage.removeItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
      return null;
    }
  }

  const accessToken = oauthToken?.provider_token;
  if (accessToken) {
    return accessToken;
  }

  return null;
}

async function authentication() {
  const accessToken = await getGitHubAccessToken();
  if (!accessToken) {
    renderGitHubLoginButton();
    return;
  }
  

  const gitHubUser = await getGitHubUser();
  if (gitHubUser) {
    trackDevRelReferral(gitHubUser.login + "|" + gitHubUser.id);
    await displayGitHubUserInformation(gitHubUser);
  }
}

(function main() {
  console.log('here')
    authentication();
})();

async function displayGitHubUserInformation(gitHubUser) {
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
    const supabase = getSupabase();
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

