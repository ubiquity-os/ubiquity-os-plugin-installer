# UbiquityOS Plugin Installer

![_Users_nv_repos_0x4007_plugin-installer-gui_index html_manifest={%22name%22_%22Start%20_%20Stop%22,%22description%22_%22Assign%20or%20un-assign%20yourself%20from%20an%20issue %22,%22ubiquity_listeners%22_ %22issue_comment created%22,%22issue](https://github.com/user-attachments/assets/353b1e84-8c1b-48eb-9d6d-1f0e5ba80fb9)

###### This was hand coded on an airplane ride with no internet.

### Plan as of 16 September 2024

- This only views the manifest you pass in
- There is a hardcoded table header which is intended to be the origin URL of the manifest file.
- Currently you need to pass in the manifest but we should pass in a URL and the UI should fetch the manifest from the URL instead (I had no network on my plane ride while building this.)

#### Add & Remove Config

- A simple answer could be to create an API (GitHub Actions?) that just asks ChatGPT to refactor the `.ubiquibot-config.yml` and push the commit. Refactoring via LLM seems pretty straightforward in my experience.
- The optimized answer is to parse the YML file, and target the config based on its URL/location. Then edit the YML file using traditional code and push the commit using the user's credentials (there is a "GitHub Sign In" button.)

#### Remarks

- I think that the remove or add buttons should display intelligently. Given that I admin two organizations that use the bot, its a bit tricky. To start perhaps it makes sense to display both but we should figure a solution out thats simple to implement.

### How To Use

Pass the manifest in the `?manifest=` query parameter for the UI to parse it.

```
?manifest={%22name%22:%22Start%20|%20Stop%22,%22description%22:%22Assign%20or%20un-assign%20yourself%20from%20an%20issue.%22,%22ubiquity:listeners%22:[%22issue_comment.created%22,%22issues.assigned%22,%22pull_request.opened%22%20],%22commands%22:{%22start%22:{%22ubiquity:example%22:%22/start%22,%22description%22:%22Assign%20yourself%20to%20the%20issue.%22},%22stop%22:{%22ubiquity:example%22:%22/stop%22,%22description%22:%22Unassign%20yourself%20from%20the%20issue.%22}}}
```

The browser automatically URI encodes it:

```json
{
  "name": "Start | Stop",
  "description": "Assign or un-assign yourself from an issue.",
  "ubiquity:listeners": ["issue_comment.created", "issues.assigned", "pull_request.opened"],
  "commands": {
    "start": {
      "ubiquity:example": "/start",
      "description": "Assign yourself to the issue."
    },
    "stop": {
      "ubiquity:example": "/stop",
      "description": "Unassign yourself from the issue."
    }
  }
}
```

###### Example from `command-start-stop/manifest.json`


## How to run

1. Clone the repository
2. Run `yarn` to install dependencies
3. OAuth: Obtain your _GitHub App_ client ID and secret from your `UbiquityOS` app fork, and set the callback URL to match the one given by Supabase when enabling GitHub provider OAuth. (You use your `UbiquityOS` instance because we check for installs against the authenticated user's organizations that they own.)
4. Replace the hardcoded `SUPABASE_URL` and `SUPABASE_KEY` in `build/esbuild-build.ts` with your Supabase URL and key (Optionally use `.env` and use `process.env` instead.)
5. Run `yarn start` and visit `localhost:8080` in your browser.
6. Once logged in you should see the orgs that you own that currently have your forked `UbiquityOS` app installed.
7. Select an org > select a config (dev | prod) > select a plugin > edit/add/remove > push to GitHub.

TODO: Update readme with a better overview of the project.
