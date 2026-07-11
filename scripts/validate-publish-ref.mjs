#!/usr/bin/env node

const [ref, version] = process.argv.slice(2);

if (!/^v\d+\.\d+\.\d+$/.test(ref ?? "")) {
  throw new Error("package-ref must be a vX.Y.Z tag");
}

if (ref !== `v${version}`) {
  throw new Error(`tag ${ref} does not match package version ${version}`);
}

process.stdout.write(ref);
