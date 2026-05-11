import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  annotateSessionInputSchema,
  annotateSessionOutputSchema,
  refineResultsInputSchema,
  refineResultsOutputSchema,
  exportSessionInputSchema,
  exportSessionOutputSchema,
  exportViewInputSchema,
  exportViewOutputSchema,
  findSessionsInputSchema,
  findSessionsOutputSchema,
  searchCacheIndexInputSchema,
  searchCacheIndexOutputSchema,
  deleteCacheInputSchema,
  deleteCacheOutputSchema,
  pruneCacheInputSchema,
  pruneCacheOutputSchema,
  listCacheInputSchema,
  listCacheOutputSchema,
  recordInputSchema,
  recordOutputSchema,
  searchInputSchema,
  searchInputToolSchema,
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
  searchKokushoFulltextInputSchema,
  searchKokushoFulltextOutputSchema,
  searchKokushoImageTagsInputSchema,
  searchKokushoImageTagsOutputSchema,
  guidesManualsInputSchema,
  guidesManualsOutputSchema,
  guidesCasesInputSchema,
  guidesCasesOutputSchema,
  resolveAuthorityInputSchema,
  resolveAuthorityOutputSchema,
  authorityTermsByClassificationInputSchema,
  authorityTermsByClassificationOutputSchema,
  searchKakenProjectsInputSchema,
  searchKakenProjectsOutputSchema,
  listSessionsInputSchema,
  listSessionsOutputSchema,
  updateSessionTraceInputSchema,
  updateSessionTraceOutputSchema
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
import { createKokushoAdapter } from "./sources/kokusho/adapter.js";
import { createKokushoClient } from "./sources/kokusho/client.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import {
  createNdlArticlesAdapter,
  createNdlArticlesOnlineAdapter,
  createNdlCatalogAdapter,
  createNdlSearchAdapter
} from "./sources/ndlSearch/adapter.js";
import { createKokkaiAdapter, createTeikokuAdapter } from "./sources/kokkai/adapter.js";
import { createNihuBridgeAdapter } from "./sources/nihuBridge/adapter.js";
import { createNijlArticlesAdapter } from "./sources/nijlArticles/adapter.js";
import { createNinjalBibliographyAdapter } from "./sources/ninjalBibliography/adapter.js";
import { createNationalArchivesAdapter } from "./sources/nationalArchives/adapter.js";
import { createJacarAdapter } from "./sources/jacar/adapter.js";
import { createCrdClient } from "./sources/crd/client.js";
import { createNdlAuthoritiesClient } from "./sources/ndlAuthorities/client.js";
import { createKakenClient } from "./sources/kaken/client.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";
import { createJpLitAnnotateSessionTool } from "./tools/jpLitAnnotateSession.js";
import { createJpLitUpdateSessionTraceTool } from "./tools/jpLitUpdateSessionTrace.js";
import { createJpLitExportSessionTool } from "./tools/jpLitExportSession.js";
import { createJpLitExportViewTool } from "./tools/jpLitExportView.js";
import { createJpLitFindSessionsTool } from "./tools/jpLitFindSessions.js";
import { createJpLitListSessionsTool } from "./tools/jpLitListSessions.js";
import { createJpLitRefineResultsTool } from "./tools/jpLitRefineResults.js";
import { createJpLitSearchCacheIndexTool } from "./tools/jpLitSearchCacheIndex.js";
import { createJpLitDeleteCacheTool } from "./tools/jpLitDeleteCache.js";
import { createJpLitPruneCacheTool } from "./tools/jpLitPruneCache.js";
import { createJpLitListCacheTool } from "./tools/jpLitListCache.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";
import { createJpLitGetTextCoordinatesTool } from "./tools/jpLitGetTextCoordinates.js";
import { createJpLitGetFulltextTool } from "./tools/jpLitGetFulltext.js";
import { createJpLitSearchPagesTool } from "./tools/jpLitSearchPages.js";
import { createJpLitSearchFulltextTool } from "./tools/jpLitSearchFulltext.js";
import { createJpLitSearchIllustrationsTool } from "./tools/jpLitSearchIllustrations.js";
import { createJpLitSearchKokushoFulltextTool } from "./tools/jpLitSearchKokushoFulltext.js";
import { createJpLitSearchKokushoImageTagsTool } from "./tools/jpLitSearchKokushoImageTags.js";
import { createJpLitSearchGuidesManualsTool } from "./tools/jpLitSearchGuidesManuals.js";
import { createJpLitSearchGuidesCasesTool } from "./tools/jpLitSearchGuidesCases.js";
import { createJpLitResolveAuthorityTool } from "./tools/jpLitResolveAuthority.js";
import { createJpLitFindAuthorityTermsByClassificationTool } from "./tools/jpLitFindAuthorityTermsByClassification.js";
import { createJpLitSearchKakenProjectsTool } from "./tools/jpLitSearchKakenProjects.js";
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
  NATIONAL_ARCHIVES_BASE_URL?: string;
  JACAR_BASE_URL?: string;
  NIJL_ARTICLES_BASE_URL?: string;
  KOKUSHO_BASE_URL?: string;
  NINJAL_BIBLIOGRAPHY_BASE_URL?: string;
  CRD_API_BASE_URL?: string;
  NDL_AUTHORITIES_SPARQL_URL?: string;
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
    },
    nijlArticles: {
      ...(env.NIJL_ARTICLES_BASE_URL ? { baseUrl: env.NIJL_ARTICLES_BASE_URL } : {})
    },
    kokusho: {
      ...(env.KOKUSHO_BASE_URL ? { baseUrl: env.KOKUSHO_BASE_URL } : {})
    },
    ninjalBibliography: {
      ...(env.NINJAL_BIBLIOGRAPHY_BASE_URL
        ? { baseUrl: env.NINJAL_BIBLIOGRAPHY_BASE_URL }
        : {})
    },
    ...(env.NATIONAL_ARCHIVES_BASE_URL
      ? {
          nationalArchives: {
            baseUrl: env.NATIONAL_ARCHIVES_BASE_URL
          }
        }
      : {}),
    ...(env.JACAR_BASE_URL
      ? {
          jacar: {
            baseUrl: env.JACAR_BASE_URL
          }
        }
      : {})
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
  const ndlAuthoritiesClient = createNdlAuthoritiesClient(
    env.NDL_AUTHORITIES_SPARQL_URL
      ? { sparqlUrl: env.NDL_AUTHORITIES_SPARQL_URL }
      : {}
  );
  const kakenClient = createKakenClient({
    appId: env.CINII_RESEARCH_APP_ID ?? ""
  });
  const kokushoClient = createKokushoClient(adapterOptions.kokusho);
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
    createNihuBridgeAdapter(adapterOptions.nihuBridge),
    createNijlArticlesAdapter(adapterOptions.nijlArticles),
    createKokushoAdapter(adapterOptions.kokusho),
    createNinjalBibliographyAdapter(adapterOptions.ninjalBibliography),
    createNationalArchivesAdapter(adapterOptions.nationalArchives),
    createJacarAdapter(adapterOptions.jacar)
  ];
  const recordService = createRecordService(adapters);
  const searchTool = createJpLitSearchTool(createSearchService(adapters), cache, sessions);
  const recordTool = createJpLitGetRecordTool(recordService, cache, sessions);
  const annotateSessionTool = createJpLitAnnotateSessionTool(sessions);
  const updateSessionTraceTool = createJpLitUpdateSessionTraceTool(sessions);
  const exportSessionTool = createJpLitExportSessionTool(sessions, sessionExporter);
  const findSessionsTool = createJpLitFindSessionsTool(sessions);
  const listSessionsTool = createJpLitListSessionsTool(sessions);
  const refineResultsTool = createJpLitRefineResultsTool(cache, sessions);
  const searchCacheIndexTool = createJpLitSearchCacheIndexTool(cache, sessions);
  const deleteCacheTool = createJpLitDeleteCacheTool(cache);
  const pruneCacheTool = createJpLitPruneCacheTool();
  const listCacheTool = createJpLitListCacheTool(cache, sessions);
  const exportViewTool = createJpLitExportViewTool({
    listCache: listCacheTool,
    searchCacheIndex: searchCacheIndexTool,
    refineResults: refineResultsTool
  });
  const textCoordinatesTool = createJpLitGetTextCoordinatesTool(recordService, nextDlClient, cache, sessions);
  const fulltextTool = createJpLitGetFulltextTool(recordService, nextDlClient, cache, sessions);
  const searchPagesTool = createJpLitSearchPagesTool(recordService, nextDlClient, cache, sessions);
  const searchFulltextTool = createJpLitSearchFulltextTool(nextDlClient, cache, sessions);
  const searchIllustrationsTool = createJpLitSearchIllustrationsTool(nextDlClient, cache, sessions);
  const searchKokushoFulltextTool = createJpLitSearchKokushoFulltextTool(kokushoClient, cache, sessions);
  const searchKokushoImageTagsTool = createJpLitSearchKokushoImageTagsTool(kokushoClient, cache, sessions);
  const searchGuidesManualsTool = createJpLitSearchGuidesManualsTool(crdClient, cache, sessions);
  const searchGuidesCasesTool = createJpLitSearchGuidesCasesTool(crdClient, cache, sessions);
  const resolveAuthorityTool = createJpLitResolveAuthorityTool(ndlAuthoritiesClient, cache, sessions);
  const findAuthorityTermsByClassificationTool =
    createJpLitFindAuthorityTermsByClassificationTool(ndlAuthoritiesClient, cache, sessions);
  const searchKakenProjectsTool = createJpLitSearchKakenProjectsTool(kakenClient, cache, sessions);

  const server = new McpServer(
    {
      name: "jp-lit-mcp",
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
      description: "日本語文献ポータルを検索する。source 未指定で8ソース横断。national_archives / jacar / nijl_articles / kokusho / ninjal_bibliography は既定横断に含めず、公文書・外交・軍事・旧外地資料、国文学論文、古典籍、日本語研究文献などで明示指定された場合のみ使う。ユーザーの言い回しから source を読み替える: 「NDL/国会図書館」→ndl_catalog、「デジコレ/NDLデジタル」→ndl_digital、「CiNii論文」→cinii_articles、「CiNii図書/大学図書館」→cinii_books、「J-STAGE」→jstage_articles、「機関リポジトリ/IRDB」→irdb、「国会会議録」→kokkai_minutes、「帝国議会」→teikoku_minutes、「人文専門DB/nihu_bridge」→nihu_bridge、「Japan Search/ジャパンサーチ」→japan_search、「国立公文書館/特定歴史公文書/太政官/省庁資料」→national_archives、「JACAR/アジア歴史資料/外交/軍事/旧外地/植民地/朝鮮/台湾/関東州」→jacar、「国文学論文/国文研論文/日本文学研究論文」→nijl_articles、「国書/古典籍/写本/版本」→kokusho、「日本語研究/日本語教育文献/国語教育文献」→ninjal_bibliography。`total` / `limit` / `page` はこの 1 回の検索呼び出し単位の値であり、Skill が複数回検索して要約する場合は各回ごとに読む。source=ndl_digital の結果にはインターネット非公開（館内限定・図書館送信）資料のメタデータも含まれる。OCR 系ツールを使う前に jp_lit_get_record で source_metadata.next_digital_library.available を確認すること",
      inputSchema: searchInputToolSchema,
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
    "jp_lit_resolve_authority",
    {
      description: "Web NDL Authorities で人名・団体名・件名などの典拠候補を確認し、別名義や安全な検索ヒントを返す。文献検索 source ではなく検索語展開・名義確認の補助ツール",
      inputSchema: resolveAuthorityInputSchema,
      outputSchema: resolveAuthorityOutputSchema
    },
    resolveAuthorityTool
  );

  server.registerTool(
    "jp_lit_find_authority_terms_by_classification",
    {
      description: "Web NDL Authorities で NDC などの分類から対応する件名標目を探し、未知の本を探すための探索語候補を返す",
      inputSchema: authorityTermsByClassificationInputSchema,
      outputSchema: authorityTermsByClassificationOutputSchema
    },
    findAuthorityTermsByClassificationTool
  );

  server.registerTool(
    "jp_lit_search_kaken_projects",
    {
      description: "KAKEN から研究課題を検索し、研究テーマ・キーワード・報告書 PDF・成果リストの手がかりを返す補助 tool。論文・図書の文献確定は CiNii / J-STAGE / IRDB / NDL で再確認する",
      inputSchema: searchKakenProjectsInputSchema,
      outputSchema: searchKakenProjectsOutputSchema
    },
    searchKakenProjectsTool
  );

  server.registerTool(
    "jp_lit_get_record",
    {
      description: "文献レコード詳細を取得する。source=national_archives / jacar は目録メタデータと公式レコードURLを返し、画像本体・IIIF・OCR本文は取得しない。source=nijl_articles は国文学論文DBのHTMLから書誌メタデータと公式レコードURLを best-effort で返し、本文・PDF・OPAC追跡は取得しない。source=kokusho は国書DBのJSONから書誌・著作・所在・公式URL・manifest URL 等のメタデータを返し、manifest 本体・画像・OCR は取得しない。source=ninjal_bibliography は日本語研究・日本語教育文献DBのHTMLから書誌メタデータと本文リンクURLを best-effort で返し、本文自体は取得しない。source=ndl_digital の場合、source_metadata.next_digital_library.available=true であれば jp_lit_get_text_coordinates / jp_lit_get_fulltext / jp_lit_search_pages が利用可能。false の場合は OCR 系ツールを利用できない。実務上は次世代側未収録であることが多いが、現実装ではアクセス制限等との厳密な区別はしていない",
      inputSchema: recordInputSchema,
      outputSchema: recordOutputSchema
    },
    recordTool
  );

  server.registerTool(
    "jp_lit_refine_results",
    {
      description: "保存済み jp_lit_search 結果を upstream 再検索せずローカルでソート・フィルタ・集合演算し、必要時だけ重複候補クラスタも返す",
      inputSchema: refineResultsInputSchema,
      outputSchema: refineResultsOutputSchema
    },
    refineResultsTool
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
    "jp_lit_update_session_trace",
    {
      description: "現在の調査セッション全体に、調査目的・確認範囲・source 選択理由・未確認事項・次アクションを追記する。検索結果や選択候補そのものではなく、調査経過と判断の台帳を残すための tool",
      inputSchema: updateSessionTraceInputSchema,
      outputSchema: updateSessionTraceOutputSchema
    },
    updateSessionTraceTool
  );

  server.registerTool(
    "jp_lit_export_session",
    {
      description: "現在の調査セッション、または session_id で指定した過去セッションを repo 内の exports/ に書き出す。既定は Markdown で、人間が読み返しやすい形に整形する",
      inputSchema: exportSessionInputSchema,
      outputSchema: exportSessionOutputSchema
    },
    exportSessionTool
  );

  server.registerTool(
    "jp_lit_find_sessions",
    {
      description: "過去の調査セッションを主題・キーワード・候補タイトル・メモから検索する。過去の探索履歴を再利用したいときに使う",
      inputSchema: findSessionsInputSchema,
      outputSchema: findSessionsOutputSchema
    },
    findSessionsTool
  );

  server.registerTool(
    "jp_lit_list_sessions",
    {
      description: "過去の調査セッションを新しい順に一覧する。検索語を覚えていない調査履歴の棚卸しや再開候補探しに使う",
      inputSchema: listSessionsInputSchema,
      outputSchema: listSessionsOutputSchema
    },
    listSessionsTool
  );

  server.registerTool(
    "jp_lit_export_view",
    {
      description: "キャッシュ系ビュー（一覧・横断検索・再抽出）の結果を exports/ に直接書き出す。refined_results は全件 export と重複確認ノートに対応",
      inputSchema: exportViewInputSchema,
      outputSchema: exportViewOutputSchema
    },
    exportViewTool
  );

  server.registerTool(
    "jp_lit_search_cache_index",
    {
      description: "保存済み jp_lit_search キャッシュを横断検索し、再抽出に使える cache_key 一覧を返す",
      inputSchema: searchCacheIndexInputSchema,
      outputSchema: searchCacheIndexOutputSchema
    },
    searchCacheIndexTool
  );

  server.registerTool(
    "jp_lit_delete_cache",
    {
      description: "ローカル保存されたキャッシュを cache_key 単位または tool 単位で削除する",
      inputSchema: deleteCacheInputSchema,
      outputSchema: deleteCacheOutputSchema
    },
    deleteCacheTool
  );

  server.registerTool(
    "jp_lit_prune_cache",
    {
      description: "古いローカルキャッシュ候補を列挙し、dry_run=false のときだけ安全に削除する",
      inputSchema: pruneCacheInputSchema,
      outputSchema: pruneCacheOutputSchema
    },
    pruneCacheTool
  );

  server.registerTool(
    "jp_lit_list_cache",
    {
      description: "ローカルキャッシュの一覧・集計を返す。日付や source で絞り込み可能",
      inputSchema: listCacheInputSchema,
      outputSchema: listCacheOutputSchema
    },
    listCacheTool
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

  server.registerTool(
    "jp_lit_search_kokusho_fulltext",
    {
      description: "国書データベースの翻刻/OCR系スニペットをキーワード検索する。本文全体・manifest 本体・画像本体は取得せず、bid、コマ番号、スニペット、公式確認 URL を返す。国書DB Web アプリの公開 JSON endpoint に依存するため、採用時は公式画面で最終確認する",
      inputSchema: searchKokushoFulltextInputSchema,
      outputSchema: searchKokushoFulltextOutputSchema
    },
    searchKokushoFulltextTool
  );

  server.registerTool(
    "jp_lit_search_kokusho_image_tags",
    {
      description: "国書データベースの画像タグをキーワード検索する。画像本体や IIIF image API は取得せず、タグ文字列、画像パス文字列、bid、コマ番号、公式確認 URL を返す。国書DB Web アプリの公開 JSON endpoint に依存するため、採用時は公式画面で最終確認する",
      inputSchema: searchKokushoImageTagsInputSchema,
      outputSchema: searchKokushoImageTagsOutputSchema
    },
    searchKokushoImageTagsTool
  );

  return server;
}

export async function startServer() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
