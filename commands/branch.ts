import { exec } from 'child_process';
import { promisify } from 'util';
import { exit } from 'process';
import { join } from 'path';
import * as dotenv from "dotenv";
import { OctokitClient } from '../utils/gitClient';
import { checkEnvVar, extractPRDetails, progressBar, writeOnFile } from '../utils/misc';

// Load environment variables from .env
dotenv.config();

// Promisify exec for asynchronous use
const execAsync = promisify(exec);

// GitHub configuration from environment variables
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

type Commit = { hash: string, message: string };

/**
 * @returns a list of commits that are in the source branch but not in the target branch.
 * @example
 * ```
 *  A---B---C (targetBranch)
 *           \
 *            D---E---F (sourceBranch)
 * 
 * listCommitsNotInBranch(sourceBranch, targetBranch) => [D, E, F];
 * ```
 */
async function listCommitsNotInBranch(sourceBranch: string, targetBranch: string): Promise<Commit[]> {
  const cmd = `git log --oneline ${targetBranch}..${sourceBranch}`;
  const { stdout } = await execAsync(cmd);

  return stdout.split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return { hash, message: messageParts.join(' ') };
    });
}

const getUniquePRs = async (
  commits: Commit[],
  git: { token: string, repoOwner: string, repoName: string },
) => {
  const octokit = new OctokitClient(git.token);
  const uniquePrs = new Map<number, any>();

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const prs = await octokit.getPullRequestsForCommit(commit.hash, git.repoOwner, git.repoName);

    for (const pr of prs) {
      if (!uniquePrs.has(pr.number)) {
        uniquePrs.set(pr.number, pr);
      }
    }

    progressBar(process, i + 1, commits.length);
  }

  return uniquePrs;
}

function checkRequiredEnvVars(): void {
  const env = process.env;
  checkEnvVar(env, 'REPO_OWNER');
  checkEnvVar(env, 'REPO_NAME');
  checkEnvVar(env, 'GITHUB_TOKEN');
}

/**
 * generate a markdown report of pull requests for commits in a source branch that are not in a target branch.
 * Useful for generating release notes for a branch. e.g: Production or Staging release report.
 */
export async function branchPRsReport(args: string[]) {
  if (args.length !== 2 || args.includes('--help')) {
    console.error('Usage: qa-tool report-branch <sourceBranch> <targetBranch>');
    exit(1);
  }

  checkRequiredEnvVars();

  const [sourceBranch, targetBranch] = args;
  const commits = await listCommitsNotInBranch(sourceBranch, targetBranch);
  console.log(`Commits on ${sourceBranch} that are not in ${targetBranch}: (total: ${commits.length})`);
  if (commits.length === 0) {
    console.log('No commits found.');
    exit(0);
  }

  const uniquePrs = await getUniquePRs(commits, { token: GITHUB_TOKEN, repoOwner: REPO_OWNER, repoName: REPO_NAME });
  if (uniquePrs.size === 0) {
    console.log('No pull requests found for the specified commits.');
    exit(0);
  }

  // Prepare markdown file path
  const markdownFilePath = join(__dirname, 'branch_report.md');
  let markdownContent = `# Pull Request Report for ${sourceBranch}\n\n`;
  uniquePrs.forEach(pr => {
    const prDetails = extractPRDetails(pr.body);

    // Append PR details to markdown content
    markdownContent += `## [#${pr.number}](${pr.html_url}): ${pr.title}\n`;
    markdownContent += `### Type:\n ${prDetails.type}\n`;
    markdownContent += `### Changelog:\n ${prDetails.changelog}\n`;
    markdownContent += `### Risk:\n ${prDetails.risk}\n`;
    markdownContent += `### Follow Up:\n ${prDetails.follow_up}\n\n`;
  });

  console.log('Writing pull request report to markdown file...');
  const writeSuccess = await writeOnFile(markdownFilePath, markdownContent);
  if (!writeSuccess) {
    console.error('Failed to write pull request report to file.');
    exit(1);
  }

  console.log(`Pull request report has been written to ${markdownFilePath}`);
}
