import { exit } from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from "dotenv";
import { Octokit } from "@octokit/core";

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

  async getPullRequestsForCommit(commitSha: string, owner: string, repo: string): Promise<any[]> {
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

// Function to list commits present in sourceBranch but not in targetBranch
async function listCommitsNotInBranch(sourceBranch: string, targetBranch: string): Promise<{ hash: string, message: string }[]> {
  const cmd = `git log --oneline ${targetBranch}..${sourceBranch}`;
  const { stdout } = await execAsync(cmd);

  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return { hash, message: messageParts.join(' ') };
    });
}

// Function to extract PR details in normal format from the PR body
function extractPRDetailsNormal(prBody: string): Record<string, string> {
  const lines = prBody.split('\n');
  const sections: Record<string, string> = {
    type: '',
    changelog: '',
    risk: '',
    follow_up: '',
  };

  let currentSection: keyof typeof sections | null = null;

  for (const line of lines) {
    const lowerCaseLine = line.toLowerCase();

    if (lowerCaseLine.includes('specify which kind of change this pr introduces')) {
      currentSection = 'type';
    } else if (lowerCaseLine.includes('how would you describe the changes in the customer visible changelog')) {
      currentSection = 'changelog';
    } else if (lowerCaseLine.includes('risks')) {
      currentSection = 'risk';
    } else if (lowerCaseLine.includes('deploy follow up')) {
      currentSection = 'follow_up';
    } else if (lowerCaseLine.startsWith('##')) {
      currentSection = null;
    }

    if (currentSection && !lowerCaseLine.startsWith('##')) {
      sections[currentSection] += line.trim() + ' ';
    }
  }

  // Trim any trailing spaces
  for (const key in sections) {
    sections[key as keyof typeof sections] = sections[key as keyof typeof sections].trim();
  }

  return sections;
}

// Function to extract PR details using defined markers
function extractPRDetails(prBody: string): Record<string, string> {
  const sections: Record<string, string> = {
    type: '',
    changelog: '',
    risk: '',
    follow_up: ''
  };

  const extractSection = (startMarker: string, endMarker: string): string => {
    const startIndex = prBody.indexOf(startMarker);
    const endIndex = prBody.indexOf(endMarker);
    if (startIndex !== -1 && endIndex !== -1) {
      return prBody.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return '';
  };

  sections.type = extractSection('<!-- START type -->', '<!-- END type -->');
  sections.changelog = extractSection('<!-- START changelog -->', '<!-- END changelog -->');
  sections.risk = extractSection('<!-- START risk -->', '<!-- END risk -->');
  sections.follow_up = extractSection('<!-- START follow_up -->', '<!-- END follow_up -->');

  return sections;
}

// Function to report on the differences between branches
async function reportOnBranch(args: string[]): Promise<void> {
  if (args.length !== 2 || args.includes('--help')) {
    console.error('Usage: qa-tool report-branch <sourceBranch> <targetBranch>');
    exit(1);
  }

  const [sourceBranch, targetBranch] = args;
  const commits = await listCommitsNotInBranch(sourceBranch, targetBranch);

  console.log(`Commits on ${sourceBranch} that are not in ${targetBranch}: (total: ${commits.length})`);
  console.log(commits);

  // Fetch associated pull requests for each commit
  const octokit = new OctokitClient(GITHUB_TOKEN);
  const uniquePrs = new Map<number, any>();

  for (const commit of commits) {
    const prs = await octokit.getPullRequestsForCommit(commit.hash, REPO_OWNER, REPO_NAME);

    for (const pr of prs) {
      if (!uniquePrs.has(pr.number)) {
        uniquePrs.set(pr.number, pr);
      }
    }
  }

  uniquePrs.forEach(pr => {
    const prDetails = extractPRDetails(pr.body);
    console.log(`[#${pr.number}](${pr.html_url}): ${pr.title}`);
    console.log(`Type: ${prDetails.type}`);
    console.log(`Changelog: ${prDetails.changelog}`);
    console.log(`Risk: ${prDetails.risk}`);
    console.log(`Follow Up: ${prDetails.follow_up}`);
    console.log();
  });
}

type CommandFn = (args: string[]) => Promise<void>;

const commands: Record<string, CommandFn> = {
  'report-branch': reportOnBranch,
};

// Helper to print available commands
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

// Helper to check required environment variables
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

// Main function to execute the selected command
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
