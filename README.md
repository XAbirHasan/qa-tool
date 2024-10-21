# QA Tool

## Overview

`qa-tool` is a command-line tool to generate pull request reports for GitHub repositories, simplifying the QA process.

This tool can be run using GitHub Actions without needing to install anything locally. Simply use this repository and the provided GitHub Actions workflow to generate reports.

## Installation

Install dependencies with:

```sh
npm install
```

## Configuration

Create a `.env` file in your project's root with:

```env
REPO_OWNER=your-repo-owner
REPO_NAME=your-repo-name
GITHUB_TOKEN=your-github-token
GIT_ROOT_DIR=your-git-root-dir (optional: default is the root of the repository)
```

## Commands

### `branch-prs-report`

Generates a markdown report of pull requests from a source branch not in a target branch. Ideal for release notes.

#### Usage

```sh
npx tsx qa-tool.ts branch-prs-report <source-branch> <target-branch> [options]
```

#### Options

- `--simple`: Simple report without PR details.
- `--no-url`: Exclude PR URLs.
- `--path <file>`: File path for the report.
- `--help`: Show help.

#### Example

```sh
npx tsx qa-tool.ts branch-prs-report feature-branch main --simple --no-url --path ./reports/main-branch-report.md
```

This generates a simple report of pull requests from `feature-branch` not in `main`, excluding PR URLs, and saves it to `./reports/main-branch-report.md`.

## Use as GitHub Actions
You can also use GitHub Actions to automate the generation of pull request reports. 

It allows you to manually trigger the qa-tool using the workflow_dispatch event. It takes inputs for the command, source branch, target branch, and whether to generate a simple report. The workflow checks out the repository, sets up Node.js, installs dependencies, runs the qa-tool, and uploads the generated report as an artifact.

### How to Use

1. **Navigate to the Actions tab**:  
  Go to your GitHub repository and click on the "Actions" tab.

2. **Select the QA-tool workflow**:  
  In the Actions tab, you will see a list of workflows. Look for the one named `QA-tool` and click on it.

3. **Trigger the workflow**:  
  Click on the "Run workflow" button. A form will appear where you can provide the necessary inputs:
    - **Command**: Choose the command to run (`branch-prs-report`).
    - **Source Branch**: Specify the source branch (default is `dev`).
    - **Target Branch**: Specify the target branch (default is `stg`).
    - **Simple Report**: Choose whether to generate a simple report without details (default is `false`).

4. **Run the workflow**:  
  After filling in the inputs, click the "Run workflow" button to start the action. The workflow will execute the `qa-tool` with the provided inputs and generate the pull request report as specified.

5. **Download the Report**:  
  Once the workflow is completed, you can download the generated report as an artifact. It can be found under: your job action -> Artifacts -> `pr-report`.


## License

Licensed under the MIT License. See the [LICENSE](LICENSE-MIT) file for details.

