#!/usr/bin/env node

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("skillmd: no command provided");
    console.log("Usage: skillmd init");
    process.exitCode = 1;
    return;
  }

  if (args[0] === "init") {
    console.log("skillmd init is not implemented yet");
    process.exitCode = 1;
    return;
  }

  console.log(`skillmd: unknown command '${args[0]}'`);
  console.log("Usage: skillmd init");
  process.exitCode = 1;
}

main();
