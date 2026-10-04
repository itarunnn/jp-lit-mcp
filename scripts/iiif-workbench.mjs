#!/usr/bin/env node
import { runIiifCli } from "../dist/src/iiif/cli.js";
process.exitCode = await runIiifCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
});
