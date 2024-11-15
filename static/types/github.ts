import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type GitHubUserResponse = RestEndpointMethodTypes["users"]["getByUsername"]["response"];
export type GitHubUser = GitHubUserResponse["data"];

export type OrgWithInstall = {
  org: string;
  install: {
    account: {
      login: string;
      id: number;
      type: "Organization" | "User";
    };
  };
};
