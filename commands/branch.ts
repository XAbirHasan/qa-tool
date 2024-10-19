import { exec } from 'child_process';
import { promisify } from 'util';
import { exit, chdir } from 'process';
import { join } from 'path';
import * as dotenv from "dotenv";
import { OctokitClient, PullRequest } from '../utils/gitClient';
import { checkEnvVar, extractPRDetails, progressBar, writeOnFile } from '../utils/misc';

// Load environment variables from .env
dotenv.config();

// Promisify exec for asynchronous use
const execAsync = promisify(exec);

const GIT_ROOT_DIR = process.env.GIT_ROOT_DIR || process.cwd(); // Default to current working directory

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
  /*
    Fetch the latest commits from the remote repository
    to ensure the local repository is up-to-date.
    This is necessary to get the latest commits from the remote repository
    and avoid missing any commits in the local repository.
  */
  await execAsync(`git fetch origin ${sourceBranch} ${targetBranch}`);
  await execAsync(`git switch ${sourceBranch}`);
  await execAsync(`git pull origin ${sourceBranch}`);
  await execAsync(`git switch ${targetBranch}`);
  await execAsync(`git pull origin ${targetBranch}`);

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
  const uniquePrs = new Map<number, PullRequest>();

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

function printUsage(): void {
  console.log('Usage: branch-prs-report <sourceBranch> <targetBranch> [options]');
  console.log('Options:');
  console.log('  --simple         : Generate a simple report without PR details');
  console.log('  --no-url         : Do not include PR URLs in the report');
  console.log('  --path <file>    : Specify the file path to write the markdown report');
  console.log('  --help           : Show usage information');
  console.log();
}

/**
 * generate a markdown report of pull requests for commits in a source branch that are not in a target branch.
 * Useful for generating release notes for a branch. e.g: Production or Staging release report.
 */
export async function branchPRsReport(args: string[]) {
  if (args.length < 2 || args.includes('--help')) {
    printUsage();
    exit(1);
  }

  checkRequiredEnvVars();

  const sourceBranch = args.shift();
  const targetBranch = args.shift();

  if (!sourceBranch || !targetBranch) {
    console.log('Error: Both sourceBranch and targetBranch must be specified.');
    exit(1);
  }

  let isSimple = false;
  let noUrl = false;
  let customPath: string | null = null;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--simple') {
      isSimple = true;
    } else if (arg === '--no-url') {
      noUrl = true;
    } else if (arg === '--path') {
      customPath = args.shift() || null;
      if (!customPath) {
        console.log('Error: --path option requires a file path.');
        exit(1);
      }
    }
  }

  // Change to the Git root directory if specified
  if (GIT_ROOT_DIR !== process.cwd()) {
    try {
      chdir(GIT_ROOT_DIR);
    } catch (error) {
      console.error(`Failed to change directory to ${GIT_ROOT_DIR}:`, error);
      exit(1);
    }
  }

  const commits = await listCommitsNotInBranch(sourceBranch, targetBranch);
  console.log(`Commits on ${sourceBranch} that are not in ${targetBranch}: (total: ${commits.length})`);
  if (commits.length === 0) {
    console.log('No commits found.');
    exit(0);
  }

  const uniquePrs = await getUniquePRs(commits, { token: GITHUB_TOKEN, repoOwner: REPO_OWNER, repoName: REPO_NAME });
  if (uniquePrs.size === 0) {
    console.log('No pull requests found for the specified commits.');
  }

  const markdownFilePath = customPath || join(__dirname, 'branch_report.md');
  let markdownContent = `## Pull Request Report for ${targetBranch}\n\n`;
  uniquePrs.forEach(pr => {
    const prDetails = extractPRDetails(pr.body ?? '');

    const mdTitle = noUrl ? `#${pr.number}: ${pr.title}` : `[#${pr.number}](${pr.html_url}): ${pr.title}`;
    // Append PR details to markdown content
    if (isSimple) {
      markdownContent += `${mdTitle}\n`;
    } else {
      markdownContent += `${mdTitle}\n\n`;
      markdownContent += `**Type:** ${prDetails.type}\n\n`;
      markdownContent += `**Changelog:**\n${prDetails.changelog}\n\n`;
      markdownContent += `**Risk:**\n${prDetails.risk}\n\n`;
      markdownContent += `**Follow Up:**\n${prDetails.follow_up}\n\n`;
      markdownContent += '------------------------------------------------------------------------\n\n';
    }
  });

  console.log('Writing pull request report to markdown file...');
  const writeSuccess = await writeOnFile(markdownFilePath, markdownContent);
  if (!writeSuccess) {
    console.error('Failed to write pull request report to file.');
    exit(1);
  }

  console.log(`Pull request report has been written to ${markdownFilePath}`);
}
