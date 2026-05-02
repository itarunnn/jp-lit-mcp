import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const platform = process.argv[2] ?? "all";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const skillsRoot = join(repoRoot, "skills");
const skillNames = ["jp-lit-research", "jp-lit-verification"];

const home = process.env.USERPROFILE ?? process.env.HOME;
if (!home) {
  throw new Error("USERPROFILE or HOME is required");
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

function patchCodexSkill(destination) {
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
    body = `${codexAdapter}${body.replace(/^\s+/, "")}`;
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
      patchCodexSkill(skillDestination);
    }
  }
}

console.log("Codex / Claude Code / Cursor 向け jp-lit Skills インストーラー");
console.log(`source: ${skillsRoot}`);
console.log(`skills: ${skillNames.join(", ")}`);
console.log("Cursor で Skills を使う場合は docs/install/github-skills.md を参照してください。");

if (platform === "all") {
  install("claude");
  install("codex");
  install("cursor");
} else {
  install(platform);
}

console.log("完了。");
