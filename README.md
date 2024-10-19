# QA Tool

## Overview

`qa-tool` is a command-line tool to generate pull request reports for GitHub repositories, simplifying the QA process.

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

## License

Licensed under the MIT License. See the [LICENSE](LICENSE-MIT) file for details.

