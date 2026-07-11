const layerContent = {
  host: ["MCP Host", "Codex などが tool を選び、JSON input を送る。サーバーの内部構造は知らない。", "outside this repo"],
  transport: ["stdio Transport", "標準入力と標準出力を MCP message の往復路にする。HTTP port は開かない。", "@modelcontextprotocol/sdk"],
  tool: ["Server + Tool", "SDK登録、Zod検証、cache/session、MCP response の形成を担う境界。", "src/server.ts → src/tools/"],
  service: ["Search Service", "source の選択、並列検索、部分失敗、結果のmergeを扱う use-case 層。", "src/services/searchService.ts"],
  adapter: ["Source Adapter", "共通 SearchParams を各APIのqueryへ、payloadを共通 item へ翻訳する。", "src/sources/"],
  cache: ["File Cache", "正規化入力から作ったkeyで structured resultを再利用する。", "src/lib/persistence/fileCache.ts"],
  session: ["Session Store", "どの結果を使い、選び、注釈したかという調査の履歴を残す。", "src/lib/persistence/sessionStore.ts"]
};

const codeNotes = {
  parse: "<b>境界：</b>TypeScript の型注釈では、プロセス外から来た値は検証できない。Zod の parse が「未知の JSON」を信頼できる入力へ変える。",
  live: "<b>実処理：</b>runCachedTool は保存戦略を共通化し、live callback だけが service を呼ぶ。業務処理と永続化方針が混ざらない。",
  response: "<b>返却：</b>text content は広い client 互換性を、structuredContent は型付きの後続処理を支える。同じ内容を二つの表現で返す。"
};

function selectLayer(element) {
  document.querySelectorAll("[data-layer]").forEach((item) => item.classList.remove("is-active"));
  element.classList.add("is-active");
  const content = layerContent[element.dataset.layer];
  if (!content) return;
  const title = document.querySelector("[data-layer-title]");
  const copy = document.querySelector("[data-layer-copy]");
  const path = document.querySelector("[data-layer-path]");
  if (title) title.textContent = content[0];
  if (copy) copy.textContent = content[1];
  if (path) path.textContent = content[2];
}

document.querySelectorAll("[data-layer]").forEach((element) => {
  element.addEventListener("click", () => selectLayer(element));
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLayer(element);
    }
  });
});

const architecture = document.querySelector(".architecture");
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    if (architecture) architecture.dataset.currentView = button.dataset.view;
  });
});

document.querySelectorAll("[data-code-note]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.codeNote;
    document.querySelectorAll("[data-code-note]").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll("[data-code-line]").forEach((line) => line.classList.toggle("is-active", line.dataset.codeLine === key));
    button.classList.add("is-active");
    const explanation = document.querySelector("[data-code-explanation]");
    if (explanation && key && codeNotes[key]) explanation.innerHTML = codeNotes[key];
  });
});

const sections = [...document.querySelectorAll("[data-section]")];
const navLinks = [...document.querySelectorAll(".rail nav a")];
function setActiveSection(id) {
  navLinks.forEach((link) => link.classList.toggle("is-active", link.hash === `#${id}`));
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveSection(visible.target.id);
  }, { rootMargin: "-20% 0px -62%", threshold: [0, 0.15, 0.5] });
  sections.forEach((section) => observer.observe(section));
} else if (sections[0]) {
  setActiveSection(sections[0].id);
}

function updateProgress() {
  const available = document.documentElement.scrollHeight - window.innerHeight;
  const progress = available > 0 ? Math.min(100, Math.max(0, window.scrollY / available * 100)) : 0;
  document.documentElement.style.setProperty("--progress", `${progress}%`);
}
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

document.querySelector('[data-layer="tool"]')?.classList.add("is-active");
document.querySelector('[data-code-line="parse"]')?.classList.add("is-active");
