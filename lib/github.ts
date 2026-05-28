import { Octokit } from "@octokit/rest";
import "dotenv/config";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export function parsePRUrl(url: string): { owner: string; repo: string; pull_number: number } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw new Error(`Invalid PR URL: ${url}`);
  return { owner: match[1], repo: match[2], pull_number: parseInt(match[3]) };
}

export async function fetchPRDiff(owner: string, repo: string, pull_number: number): Promise<string> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  return response.data as unknown as string;
}

export async function fetchPRHeadSha(owner: string, repo: string, pull_number: number): Promise<string> {
  const { data } = await octokit.pulls.get({ owner, repo, pull_number });
  return data.head.sha;
}
