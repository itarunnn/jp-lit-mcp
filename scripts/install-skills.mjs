#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arguments_ = process.argv.slice(2);
const targets = new Set(["codex", "cursor", "claude", "all"]);
let platform;
let help = false;
for (const argument of arguments_) {
  if (argument === "--help" || argument === "-h") {
    help = true;
  } else if (!targets.has(argument)) {
    console.error(`Unknown platform or argument: ${argument}. Use cursor, claude, codex, or all.`);
    process.exit(1);
  } else if (platform !== undefined) {
    console.error("Specify one target: cursor, claude, codex, or all.");
    process.exit(1);
  } else {
    platform = argument;
  }
}
if (help) {
  console.log(`Codex / Claude Code / Cursor 向け jp-lit Skills インストーラー

Usage:
  jp-lit-mcp install-skills [codex|cursor|claude|all]
  jp-lit-mcp install-skills --help

対象を省略すると全3アプリへ全4Skillsを導入します。
通常の導入・更新は既存の同名Skillsを置き換えます。個別編集は事前に退避してください。
--help / -h はヘルプだけを表示します。`);
  process.exit(0);
}
platform ??= "all";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const skillsRoot = join(repoRoot, "skills");
const skillNames = ["jp-lit-research", "jp-lit-verification", "jp-lit-tei", "jp-lit-iiif"];

const home = process.env.JP_LIT_SKILLS_HOME ?? process.env.USERPROFILE ?? process.env.HOME;
if (!home) {
  throw new Error("JP_LIT_SKILLS_HOME, USERPROFILE, or HOME is required");
}

const destinations = {
  claude: join(home, ".claude", "skills"),
  codex: join(home, ".agents", "skills"),
  cursor: join(home, ".cursor", "skills")
};

const codexAdapter = `<codex_skill_adapter>
## 起動
このスキルは jp-lit MCP を使った日本語文献調査または文献検証の依頼で呼び出される。
\`AskUserQuestion\` / \`Task()\` は使用しない。直接実行する。
</codex_skill_adapter>

`;

function copySkillTree(skillName, destinationRoot) {
  const skillSrc = join(skillsRoot, skillName);
  const destination = join(destinationRoot, skillName);
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(skillSrc, destination, { recursive: true });
  return destination;
}

function patchCodexSkill(destination, skillName) {
  const skillPath = join(destination, "SKILL.md");
  const content = readFileSync(skillPath, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`SKILL.md frontmatter not found: ${skillPath}`);
  }

  let [, frontmatter, body] = match;

  if (!/^metadata:\s*$/m.test(frontmatter)) {
    frontmatter = `${frontmatter.trimEnd()}
metadata:
  short-description: "jp-lit MCP を使った日本語人文社会系文献調査スキル"`;
  } else if (!/^\s+short-description:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /^metadata:\s*$/m,
      'metadata:\n  short-description: "jp-lit MCP を使った日本語人文社会系文献調査スキル"'
    );
  }

  if (!body.includes("<codex_skill_adapter>")) {
    const adapter = skillName === "jp-lit-iiif" ? codexAdapter.replace("jp-lit MCP を使った日本語文献調査または文献検証", "任意CLI jp-lit-iiif を使った画像比較または画像読解") : codexAdapter;
    body = `${adapter}${body.replace(/^\s+/, "")}`;
  }

  writeFileSync(skillPath, `---\n${frontmatter.trimEnd()}\n---\n\n${body}`, "utf8");
}

function install(target) {
  const destination = destinations[target];
  if (!destination) {
    throw new Error(`Unknown platform: ${target}. Use cursor, claude, codex, or all.`);
  }

  for (const skillName of skillNames) {
    const skillDestination = copySkillTree(skillName, destination);
    console.log(`[${target}] ${skillDestination}`);
    if (target === "codex") {
      patchCodexSkill(skillDestination, skillName);
    }
  }
}

console.log("Codex / Claude Code / Cursor 向け jp-lit Skills インストーラー");
console.log(`source: ${skillsRoot}`);
console.log(`skills: ${skillNames.join(", ")}`);

if (platform === "all") {
  install("claude");
  install("codex");
  install("cursor");
} else {
  install(platform);
}

console.log("完了。");
