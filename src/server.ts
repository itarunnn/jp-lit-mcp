import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  annotateSessionInputSchema,
  annotateSessionOutputSchema,
  exportSessionInputSchema,
  exportSessionOutputSchema,
  recordInputSchema,
  recordOutputSchema,
  searchInputSchema,
  searchOutputSchema,
  textCoordinatesInputSchema,
  textCoordinatesOutputSchema,
  fulltextInputSchema,
  fulltextOutputSchema,
  searchPagesInputSchema,
  searchPagesOutputSchema,
  searchFulltextInputSchema,
  searchFulltextOutputSchema,
  searchIllustrationsInputSchema,
  searchIllustrationsOutputSchema,
  guidesManualsInputSchema,
  guidesManualsOutputSchema,
  guidesCasesInputSchema,
  guidesCasesOutputSchema
} from "./lib/schemas.js";
import { createFileCache } from "./lib/persistence/fileCache.js";
import { createSessionExporter } from "./lib/persistence/exportSession.js";
import { createSessionStore } from "./lib/persistence/sessionStore.js";
import { createRecordService } from "./services/recordService.js";
import { createSearchService } from "./services/searchService.js";
import {
  createCiniiArticlesAdapter,
  createCiniiBooksAdapter
} from "./sources/ciniiResearch/adapter.js";
import { createJapanSearchAdapter } from "./sources/japanSearch/adapter.js";
import { createIrdbAdapter } from "./sources/irdb/adapter.js";
import { createJdcatAdapter } from "./sources/jdcat/adapter.js";
import { createJstageArticlesAdapter } from "./sources/jstage/adapter.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import {
  createNdlArticlesAdapter,
  createNdlArticlesOnlineAdapter,
  createNdlCatalogAdapter,
  createNdlSearchAdapter
} from "./sources/ndlSearch/adapter.js";
import { createKokkaiAdapter, createTeikokuAdapter } from "./sources/kokkai/adapter.js";
import { createNihuBridgeAdapter } from "./sources/nihuBridge/adapter.js";
import { createCrdClient } from "./sources/crd/client.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";
import { createJpLitAnnotateSessionTool } from "./tools/jpLitAnnotateSession.js";
import { createJpLitExportSessionTool } from "./tools/jpLitExportSession.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";
import { createJpLitGetTextCoordinatesTool } from "./tools/jpLitGetTextCoordinates.js";
import { createJpLitGetFulltextTool } from "./tools/jpLitGetFulltext.js";
import { createJpLitSearchPagesTool } from "./tools/jpLitSearchPages.js";
import { createJpLitSearchFulltextTool } from "./tools/jpLitSearchFulltext.js";
import { createJpLitSearchIllustrationsTool } from "./tools/jpLitSearchIllustrations.js";
import { createJpLitSearchGuidesManualsTool } from "./tools/jpLitSearchGuidesManuals.js";
import { createJpLitSearchGuidesCasesTool } from "./tools/jpLitSearchGuidesCases.js";
import { createNextDigitalLibraryClient } from "./sources/nextDigitalLibrary/adapter.js";

interface ServerEnv {
  NDL_SEARCH_BASE_URL?: string;
  NDL_DIGITAL_BASE_URL?: string;
  NEXT_DIGITAL_LIBRARY_BASE_URL?: string;
  CINII_RESEARCH_BASE_URL?: string;
  CINII_RESEARCH_RECORD_BASE_URL?: string;
  CINII_BOOKS_HOLDINGS_BASE_URL?: string;
  CINII_RESEARCH_APP_ID?: string;
  JSTAGE_BASE_URL?: string;
  JSTAGE_ARTICLE_BASE_URL?: string;
  JAPAN_SEARCH_BASE_URL?: string;
  JAPAN_SEARCH_ITEM_BASE_URL?: string;
  IRDB_SEARCH_BASE_URL?: string;
  IRDB_DETAIL_BASE_URL?: string;
  JDCAT_BASE_URL?: string;
  KOKKAI_SPEECH_BASE_URL?: string;
  KOKKAI_MEETING_BASE_URL?: string;
  TEIKOKU_SPEECH_BASE_URL?: string;
  TEIKOKU_MEETING_BASE_URL?: string;
  NIHU_BRIDGE_SEARCH_URL?: string;
  NIHU_BRIDGE_RECORD_BASE_URL?: string;
  CRD_API_BASE_URL?: string;
}

const SEARCH_ENDPOINT_PATH = "/api/sru";
const LEGACY_SEARCH_ENDPOINT_PATH = "/api/opensearch";
const RECORD_ENDPOINT_PATH = "/api/bib/external/search";

function stripTrailingSlash(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

function replaceKnownEndpointPath(pathname: string, targetPath: string) {
  const normalizedPathname = stripTrailingSlash(pathname);

  if (normalizedPathname.endsWith(SEARCH_ENDPOINT_PATH)) {
    return `${normalizedPathname.slice(0, -SEARCH_ENDPOINT_PATH.length)}${targetPath}`;
  }

  if (normalizedPathname.endsWith(LEGACY_SEARCH_ENDPOINT_PATH)) {
    return `${normalizedPathname.slice(0, -LEGACY_SEARCH_ENDPOINT_PATH.length)}${targetPath}`;
  }

  if (normalizedPathname.endsWith(RECORD_ENDPOINT_PATH)) {
    return `${normalizedPathname.slice(0, -RECORD_ENDPOINT_PATH.length)}${targetPath}`;
  }

  return null;
}

function withPathname(url: URL, pathname: string) {
  const nextUrl = new URL(url.toString());

  nextUrl.pathname = pathname;
  nextUrl.search = "";
  nextUrl.hash = "";

  return nextUrl.toString();
}

function resolveAdapterUrls(baseUrl: string | undefined) {
  if (!baseUrl) {
    return {};
  }

  const url = new URL(baseUrl);
  const searchPathname = replaceKnownEndpointPath(url.pathname, SEARCH_ENDPOINT_PATH);
  const recordPathname = replaceKnownEndpointPath(url.pathname, RECORD_ENDPOINT_PATH);
  const searchBaseUrl =
    searchPathname === null ? url.toString() : withPathname(url, searchPathname);
  const recordBaseUrl = withPathname(
    url,
    recordPathname ?? RECORD_ENDPOINT_PATH
  );

  return {
    searchBaseUrl,
    recordBaseUrl
  };
}

export function resolveAdapterOptionsFromEnv(env: ServerEnv = process.env) {
  return {
    ndlSearch: {
      ...resolveAdapterUrls(env.NDL_SEARCH_BASE_URL),
      ...(env.CINII_RESEARCH_RECORD_BASE_URL ? { ciniiRecordBaseUrl: env.CINII_RESEARCH_RECORD_BASE_URL } : {})
    },
    ndlDigital: {
      ...resolveAdapterUrls(env.NDL_DIGITAL_BASE_URL),
      ...(env.NEXT_DIGITAL_LIBRARY_BASE_URL ? { nextDlBaseUrl: env.NEXT_DIGITAL_LIBRARY_BASE_URL } : {})
    },
    ciniiResearch: {
      ...(env.CINII_RESEARCH_BASE_URL
        ? {
            searchBaseUrl: env.CINII_RESEARCH_BASE_URL
          }
        : {}),
      ...(env.CINII_RESEARCH_RECORD_BASE_URL
        ? {
            recordBaseUrl: env.CINII_RESEARCH_RECORD_BASE_URL
          }
        : {}),
      ...(env.CINII_BOOKS_HOLDINGS_BASE_URL
        ? {
            holdingsBaseUrl: env.CINII_BOOKS_HOLDINGS_BASE_URL
          }
        : {}),
      ...(env.CINII_RESEARCH_APP_ID
        ? {
            appId: env.CINII_RESEARCH_APP_ID
          }
        : {})
    },
    jstage: {
      ...(env.JSTAGE_BASE_URL
        ? {
            searchBaseUrl: env.JSTAGE_BASE_URL
          }
        : {}),
      ...(env.JSTAGE_ARTICLE_BASE_URL
        ? {
            articleBaseUrl: env.JSTAGE_ARTICLE_BASE_URL
          }
        : {})
    },
    japanSearch: {
      ...(env.JAPAN_SEARCH_BASE_URL
        ? {
            searchBaseUrl: env.JAPAN_SEARCH_BASE_URL
          }
        : {}),
      ...(env.JAPAN_SEARCH_ITEM_BASE_URL
        ? {
            itemBaseUrl: env.JAPAN_SEARCH_ITEM_BASE_URL
          }
        : {})
    },
    irdb: {
      ...(env.IRDB_SEARCH_BASE_URL
        ? {
            searchBaseUrl: env.IRDB_SEARCH_BASE_URL
          }
        : {}),
      ...(env.IRDB_DETAIL_BASE_URL
        ? {
            detailBaseUrl: env.IRDB_DETAIL_BASE_URL
          }
        : {})
    },
    jdcat: {
      ...(env.JDCAT_BASE_URL
        ? {
            baseUrl: env.JDCAT_BASE_URL
          }
        : {})
    },
    kokkai: {
      ...(env.KOKKAI_SPEECH_BASE_URL ? { speechBaseUrl: env.KOKKAI_SPEECH_BASE_URL } : {}),
      ...(env.KOKKAI_MEETING_BASE_URL ? { meetingBaseUrl: env.KOKKAI_MEETING_BASE_URL } : {})
    },
    teikoku: {
      ...(env.TEIKOKU_SPEECH_BASE_URL ? { speechBaseUrl: env.TEIKOKU_SPEECH_BASE_URL } : {}),
      ...(env.TEIKOKU_MEETING_BASE_URL ? { meetingBaseUrl: env.TEIKOKU_MEETING_BASE_URL } : {})
    },
    nihuBridge: {
      ...(env.NIHU_BRIDGE_SEARCH_URL ? { searchUrl: env.NIHU_BRIDGE_SEARCH_URL } : {}),
      ...(env.NIHU_BRIDGE_RECORD_BASE_URL ? { recordBaseUrl: env.NIHU_BRIDGE_RECORD_BASE_URL } : {})
    }
  };
}

export function createServer(env: ServerEnv = process.env) {
  const cache = createFileCache();
  const sessions = createSessionStore();
  const sessionExporter = createSessionExporter(cache);
  const adapterOptions = resolveAdapterOptionsFromEnv(env);
  const nextDlClient = createNextDigitalLibraryClient(
    env.NEXT_DIGITAL_LIBRARY_BASE_URL ? { baseUrl: env.NEXT_DIGITAL_LIBRARY_BASE_URL } : {}
  );
  const crdClient = createCrdClient(
    env.CRD_API_BASE_URL ? { baseUrl: env.CRD_API_BASE_URL } : {}
  );
  const adapters = [
    createNdlSearchAdapter(adapterOptions.ndlSearch),
    createNdlCatalogAdapter(adapterOptions.ndlSearch),
    createNdlDigitalAdapter(adapterOptions.ndlDigital),
    createNdlArticlesAdapter(adapterOptions.ndlSearch),
    createNdlArticlesOnlineAdapter(adapterOptions.ndlSearch),
    createCiniiArticlesAdapter(adapterOptions.ciniiResearch),
    createIrdbAdapter(adapterOptions.irdb),
    createJdcatAdapter(adapterOptions.jdcat),
    createJstageArticlesAdapter(adapterOptions.jstage),
    createJapanSearchAdapter(adapterOptions.japanSearch),
    createCiniiBooksAdapter(adapterOptions.ciniiResearch),
    createKokkaiAdapter(adapterOptions.kokkai),
    createTeikokuAdapter(adapterOptions.teikoku),
    createNihuBridgeAdapter(adapterOptions.nihuBridge)
  ];
  const recordService = createRecordService(adapters);
  const searchTool = createJpLitSearchTool(createSearchService(adapters), cache, sessions);
  const recordTool = createJpLitGetRecordTool(recordService, cache, sessions);
  const annotateSessionTool = createJpLitAnnotateSessionTool(sessions);
  const exportSessionTool = createJpLitExportSessionTool(sessions, sessionExporter);
  const textCoordinatesTool = createJpLitGetTextCoordinatesTool(recordService, nextDlClient, cache, sessions);
  const fulltextTool = createJpLitGetFulltextTool(recordService, nextDlClient, cache, sessions);
  const searchPagesTool = createJpLitSearchPagesTool(recordService, nextDlClient, cache, sessions);
  const searchFulltextTool = createJpLitSearchFulltextTool(nextDlClient, cache, sessions);
  const searchIllustrationsTool = createJpLitSearchIllustrationsTool(nextDlClient, cache, sessions);
  const searchGuidesManualsTool = createJpLitSearchGuidesManualsTool(crdClient, cache, sessions);
  const searchGuidesCasesTool = createJpLitSearchGuidesCasesTool(crdClient, cache, sessions);

  const server = new McpServer(
    {
      name: "ndl-jp-lit-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.registerTool(
    "jp_lit_search",
    {
      description: "日本語文献ポータルを検索する。source=ndl_digital の結果にはインターネット非公開（館内限定・図書館送信）資料のメタデータも含まれる。OCR 系ツールを使う前に jp_lit_get_record で source_metadata.next_digital_library.available を確認すること",
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema
    },
    searchTool
  );

  server.registerTool(
    "jp_lit_search_guides_manuals",
    {
      description: "レファレンス協同データベースの調べ方マニュアルを検索する。書誌検索ではなく、どの資料や索引・参考図書をどう使って調べるかの手がかりを得るためのツール",
      inputSchema: guidesManualsInputSchema,
      outputSchema: guidesManualsOutputSchema
    },
    searchGuidesManualsTool
  );

  server.registerTool(
    "jp_lit_search_guides_cases",
    {
      description: "レファレンス協同データベースのレファレンス事例を検索する。類似質問、回答プロセス、参考資料を調査の次の一手の材料として参照するためのツール",
      inputSchema: guidesCasesInputSchema,
      outputSchema: guidesCasesOutputSchema
    },
    searchGuidesCasesTool
  );

  server.registerTool(
    "jp_lit_get_record",
    {
      description: "文献レコード詳細を取得する。source=ndl_digital の場合、source_metadata.next_digital_library.available=true であれば jp_lit_get_text_coordinates / jp_lit_get_fulltext / jp_lit_search_pages が利用可能。false の場合は OCR 系ツールを利用できない。実務上は次世代側未収録であることが多いが、現実装ではアクセス制限等との厳密な区別はしていない",
      inputSchema: recordInputSchema,
      outputSchema: recordOutputSchema
    },
    recordTool
  );

  server.registerTool(
    "jp_lit_annotate_session",
    {
      description: "現在の調査セッション内で、既存の検索・書誌取得結果に候補ラベルと短いメモを保存する。未選別結果そのものは変更せず、選別判断だけを追加する",
      inputSchema: annotateSessionInputSchema,
      outputSchema: annotateSessionOutputSchema
    },
    annotateSessionTool
  );

  server.registerTool(
    "jp_lit_export_session",
    {
      description: "現在の調査セッションを repo 内の exports/ に書き出す。既定は Markdown で、人間が読み返しやすい形に整形する",
      inputSchema: exportSessionInputSchema,
      outputSchema: exportSessionOutputSchema
    },
    exportSessionTool
  );

  server.registerTool(
    "jp_lit_get_text_coordinates",
    {
      description: "NDL デジタルコレクション資料のページ単位 OCR テキストと座標を取得する（インターネット公開資料のみ）。source_id を使う場合は事前に jp_lit_get_record で next_digital_library.available=true を確認すること。jp_lit_search_fulltext の結果の pid はそのまま渡してよい",
      inputSchema: textCoordinatesInputSchema,
      outputSchema: textCoordinatesOutputSchema
    },
    textCoordinatesTool
  );

  server.registerTool(
    "jp_lit_get_fulltext",
    {
      description: "NDL デジタルコレクション資料の全文 OCR JSON を取得する（インターネット公開資料のみ）。source_id を使う場合は事前に jp_lit_get_record で next_digital_library.available=true を確認すること。jp_lit_search_fulltext の結果の pid はそのまま渡してよい",
      inputSchema: fulltextInputSchema,
      outputSchema: fulltextOutputSchema
    },
    fulltextTool
  );

  server.registerTool(
    "jp_lit_search_pages",
    {
      description: "NDL デジタルコレクション資料内のページをキーワードで全文検索する（インターネット公開資料のみ）。source_id を使う場合は事前に jp_lit_get_record で next_digital_library.available=true を確認すること。jp_lit_search_fulltext の結果の pid はそのまま渡してよい",
      inputSchema: searchPagesInputSchema,
      outputSchema: searchPagesOutputSchema
    },
    searchPagesTool
  );

  server.registerTool(
    "jp_lit_search_fulltext",
    {
      description: "NDL デジタルコレクション全資料を対象に OCR 全文テキストからキーワード検索する（公開範囲のみ）。searchfield=contentonly で本文のみ、metaonly でメタデータのみ、all で両方を検索。結果には pid が含まれ jp_lit_search_pages 等で直接利用できる",
      inputSchema: searchFulltextInputSchema,
      outputSchema: searchFulltextOutputSchema
    },
    searchFulltextTool
  );

  server.registerTool(
    "jp_lit_search_illustrations",
    {
      description: "NDL デジタルコレクション全資料の図版・挿絵をテキストキーワードで検索する（公開範囲のみ）。結果には IIIF 画像 URL（ページ全体・図版トリミング）を含む",
      inputSchema: searchIllustrationsInputSchema,
      outputSchema: searchIllustrationsOutputSchema
    },
    searchIllustrationsTool
  );

  return server;
}

export async function startServer() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
