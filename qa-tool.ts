import { exit } from 'process';
type CommandFn = (args: string[]) => Promise<void>;

const commands: Record<string, CommandFn> = {
  
};

function printUsage() {
  console.log('Usage: qa-tool <cmd> [args...]');
  console.log();
  console.log('Available commands:');
  for (const command in commands) {
    console.log(` qa-tool ${command}`);
  }
  console.log();
  console.log('Run "qa-tool <cmd> --help" for details.');
  console.log();
}

async function main(args: string[]) {
  if (args.length === 0) {
    printUsage();
    exit(0);
  }

  const commandFn = commands[args[0]];
  if (!commandFn) {
    console.error(`Invalid command "${args[0]}"`);
    exit(1);
  }

  await commandFn(args.slice(1));
}

main(process.argv.slice(2))
  .catch(err => console.error(`qa-tool error: `, JSON.stringify(err, null, 2)));
