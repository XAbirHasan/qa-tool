import { Octokit } from "@octokit/core";

export class OctokitClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequestsForCommit(commitSha: string, owner: string, repo: string) {
    try {
      const response = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
        owner,
        repo,
        commit_sha: commitSha,
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching pull requests for commit ${commitSha}:`, error);
      return [];
    }
  }
}
