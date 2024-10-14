import { exit } from 'process';
import { promises as fsp } from 'fs';

/**
 * Check if an environment variable is set, and exit the process if it's not.
 */
export const checkEnvVar = (env: NodeJS.ProcessEnv, name: string): void => {
  if (!env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    exit(1);
  }
};

/**
 * Simple progress bar to display the progress of a long-running process
 */
export const progressBar = (process: NodeJS.Process, current: number, total: number) => {
  const barLength = 40; // Adjust this length to fit your terminal size
  const progress = Math.round((current / total) * barLength);

  const filledBar = '='.repeat(progress);
  const emptyBar = '-'.repeat(barLength - progress);
  const progressBar = `${filledBar}${emptyBar}`;
  const percentage = ((current / total) * 100).toFixed(2);

  process.stdout.write(`\rProgress: [${progressBar}] ${percentage}% (${current}/${total} processed)`);
  if (current === total) {
    console.log('\nSuccessfully processed all!');
  }
};

/*
  Function to extract PR details from the PR body using commented markers.
  This may vary based on the PR template used in the repository.
  check: pull_request_template.md
*/
export const extractPRDetails = (prTemplate: string) => {
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

/**
 * Function to write content to a file.
 * @returns true if the file was written successfully, false otherwise
 */
export const writeOnFile = async (path: string, content: string): Promise<boolean> => { 
  try {
    await fsp.writeFile(path, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to write file:', error);
    return false;
  }
};
