import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type GitHubUserResponse = RestEndpointMethodTypes["users"]["getByUsername"]["response"];
export type GitHubUser = GitHubUserResponse["data"];

export type ExtendedHtmlElement<T = HTMLElement> = {
  [key in keyof T]: T[key] extends HTMLElement["innerHTML"] ? string | null : T[key];
};
