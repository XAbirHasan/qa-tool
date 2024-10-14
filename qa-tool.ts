import { exit } from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from "dotenv";
import { Octokit } from "@octokit/core";
import { promises as fsp } from 'fs';
import { join } from 'path';

// Promisify exec for asynchronous use
const execAsync = promisify(exec);

// Load environment variables from .env
dotenv.config();

// GitHub configuration from environment variables
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Octokit client for GitHub API interaction
class OctokitClient {
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

/*
  Function to extract PR details from the PR body using commented markers.
  This may vary based on the PR template used in the repository.
*/
function extractPRDetails(prTemplate: string) {
  const extractAfterMarker = (startMarker: string, endMarker: string) => {
    const startIndex = prTemplate.indexOf(startMarker);
    if (startIndex === -1) return '';

    const endIndex = prTemplate.indexOf(endMarker, startIndex);
    if (endIndex === -1) return '';

    // Get the text between markers and remove the marker line
    const section = prTemplate.slice(startIndex + startMarker.length, endIndex);

    // Split by lines and remove the first line (marker line)
    const sectionLines = section.split('\n').slice(1).join('\n').trim();
    return sectionLines;
  };

  return {
    type: extractAfterMarker('<!-- type -->', '##'),
    changelog: extractAfterMarker('<!-- changelog -->', '##'),
    risk: extractAfterMarker('<!-- risk -->', '##'),
    follow_up: extractAfterMarker('<!-- follow_up -->', '##')
  };
}

function progressBar(current: number, total: number) {
  const barLength = 40; // Adjust this length to fit your terminal size
  const progress = Math.round((current / total) * barLength);

  const filledBar = '='.repeat(progress);
  const emptyBar = '-'.repeat(barLength - progress);
  const progressBar = `${filledBar}${emptyBar}`;
  const percentage = ((current / total) * 100).toFixed(2);

  process.stdout.write(`\rProgress: [${progressBar}] ${percentage}% (${current}/${total} commits processed)`);
  if (current === total) {
    console.log('\nSuccessfully processed all commits!');
  }
}

async function reportOnBranch(args: string[]) {
  if (args.length !== 2 || args.includes('--help')) {
    console.error('Usage: qa-tool report-branch <sourceBranch> <targetBranch>');
    exit(1);
  }

  const [sourceBranch, targetBranch] = args;
  const commits = await listCommitsNotInBranch(sourceBranch, targetBranch);
  console.log(`Commits on ${sourceBranch} that are not in ${targetBranch}: (total: ${commits.length})`);

  // Prepare markdown file path
  const markdownFilePath = join(__dirname, 'branch_report.md');
  let markdownContent = `# Pull Request Report for ${sourceBranch}\n\n`;

  const octokit = new OctokitClient(GITHUB_TOKEN);
  const uniquePrs = new Map<number, any>();

  // Start processing commits
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const prs = await octokit.getPullRequestsForCommit(commit.hash, REPO_OWNER, REPO_NAME);

    for (const pr of prs) {
      if (!uniquePrs.has(pr.number)) {
        uniquePrs.set(pr.number, pr);
      }
    }

    // Update the progress bar after each commit is processed
    progressBar(i + 1, commits.length);
  }

  uniquePrs.forEach(pr => {
    const prDetails = extractPRDetails(pr.body);

    // Append PR details to markdown content
    markdownContent += `## [#${pr.number}](${pr.html_url}): ${pr.title}\n`;
    markdownContent += `### Type:\n ${prDetails.type}\n`;
    markdownContent += `### Changelog:\n ${prDetails.changelog}\n`;
    markdownContent += `### Risk:\n ${prDetails.risk}\n`;
    markdownContent += `### Follow Up:\n ${prDetails.follow_up}\n\n`;
  });

  // Write markdown content to the file
  try {
    console.log('Writing pull request report to markdown file...');
    await fsp.writeFile(markdownFilePath, markdownContent, 'utf8');
    console.log(`Pull request report has been written to ${markdownFilePath}`);
  } catch (error) {
    console.error('Failed to write markdown file:', error);
  }
}

type CommandFn = (args: string[]) => Promise<void>;
const commands: Record<string, CommandFn> = {
  'report-branch': reportOnBranch,
};

function printUsage(): void {
  console.log('Usage: qa-tool <cmd> [args...]');
  console.log();
  console.log('Available commands:');
  for (const command in commands) {
    console.log(` qa-tool ${command}`);
  }
  console.log();
  console.log('Run "qa-tool <cmd> --help" for details.');
}

function checkEnvVar(name: string): void {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    exit(1);
  }
}

function checkRequiredEnvVars(): void {
  checkEnvVar('REPO_OWNER');
  checkEnvVar('REPO_NAME');
  checkEnvVar('GITHUB_TOKEN');
}

async function main(args: string[]): Promise<void> {
  if (args.length === 0) {
    printUsage();
    exit(0);
  }

  checkRequiredEnvVars();

  const commandFn = commands[args[0]];
  if (!commandFn) {
    console.error(`Invalid command "${args[0]}"`);
    exit(1);
  }

  await commandFn(args.slice(1));
}

main(process.argv.slice(2))
  .catch(err => console.error('qa-tool error:', JSON.stringify(err, null, 2)));
