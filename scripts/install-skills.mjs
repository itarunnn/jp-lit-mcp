import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const platform = process.argv[2] ?? "all";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const skillSrc = join(repoRoot, ".cursor", "skills", "jp-lit-research");

const home = process.env.USERPROFILE ?? process.env.HOME;
if (!home) {
  throw new Error("USERPROFILE or HOME is required");
}

const destinations = {
  claude: join(home, ".claude", "skills", "jp-lit-research"),
  codex: join(home, ".codex", "skills", "jp-lit-research")
};

const codexAdapter = `<codex_skill_adapter>
## 起動
このスキルは jp-lit MCP を使った日本語文献調査の依頼で呼び出される。
\`AskUserQuestion\` / \`Task()\` は使用しない。直接実行する。
</codex_skill_adapter>

`;

function copySkill(destination) {
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(skillSrc, destination, { recursive: true });
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
  if (target === "cursor") {
    console.log("[Cursor] プロジェクト内 .cursor/skills/ は自動検出されます。インストール不要。");
    return;
  }

  const destination = destinations[target];
  if (!destination) {
    throw new Error(`Unknown platform: ${target}. Use cursor, claude, codex, or all.`);
  }

  console.log(`[${target}] ${destination}`);
  copySkill(destination);
  if (target === "codex") {
    patchCodexSkill(destination);
  }
}

console.log("jp-lit-research Skill インストーラー");
console.log(`source: ${skillSrc}`);

if (platform === "all") {
  install("claude");
  install("codex");
} else {
  install(platform);
}

console.log("完了。");
