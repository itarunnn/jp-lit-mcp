# TEI・IIIFの必要環境を準備する

**基本の文献検索・書誌確認・文献検証は、Node.js 22以上、npm、MCP対応AIアプリで使えます。TEI・IIIFは任意機能で、Pythonを導入していなくても基本機能を利用できます。** 公開DBのOCR全文検索も基本機能に含まれ、手元の画像にOCRをかける機能とは導入条件が異なります。

まず[使うアプリの導入ガイド](#mcpとskillsの導入を確認する)でMCPを登録し、Skillsを配置します。その後、使いたい任意機能だけを下の手順で準備してください。

## パッケージとSkillsに含まれるもの

`jp-lit-mcp`のnpmパッケージには、MCPサーバー、4つのSkills、TEI readerのコードと環境定義、IIIF CLIとViewerを同梱しています。TEI・IIIF用の別パッケージを探す必要はありません。各アプリでSkillsを使うには、MCP登録に加えてSkillsを配置します。

| Skillsの導入コマンド | 配置するもの |
| --- | --- |
| `gh skill install itarunnn/jp-lit-mcp --all`にアプリ・配置先の指定を付ける | 指定先へ全4Skills |
| `npx -y jp-lit-mcp install-skills codex`（または`cursor`、`claude`） | 指定アプリへ全4Skills |
| `npx -y jp-lit-mcp install-skills all` | Codex・Cursor・Claude Codeの3アプリすべてへ、それぞれ全4Skills |

4つは`jp-lit-research`、`jp-lit-verification`、`jp-lit-tei`、`jp-lit-iiif`です。TEI・IIIFを使わない場合も、全4Skillsを配置したままで基本機能を利用できます。

SkillsはAIへ操作手順を渡すファイルです。上のコマンドが準備する範囲はSkillsの配置で、uv・Python・OCRエンジンの導入やMCP登録は別の手順です。使うアプリの導入ガイドで、GitHub経由とnpm経由のどちらか一方を選んでください。既存の同名Skillsは置き換わるため、個別の編集は事前に退避します。

## 機能ごとの必要環境

| 使う機能 | 利用者が用意するもの | 自動で準備される範囲・タイミング |
| --- | --- | --- |
| 基本の文献検索・書誌確認・文献検証 | Node.js 22以上、npm、MCP対応AIアプリ | `npx`でMCPのnpmパッケージを取得 |
| TEI readerによる保存XMLの読解 | 基本環境に加えてuv | readerの初回起動時にPython 3.13.15と専用環境を準備 |
| IIIF比較画面・領域選択・出典保存 | 基本環境に加えてWebブラウザ | 同梱のViewerを使用。Pythonは不要 |
| IIIFとTEI本文の対応付け | IIIFとTEI readerの環境 | TEI readerの環境を使用 |
| 保存図版の類似検索・整列・差分 | IIIFの環境に加えてuv、初回の明示セットアップ | `--setup`実行時にPython 3.13系とOpenCVなどの専用環境を準備 |
| ローカルくずし字OCR | IIIFの環境に加えて、選んだOCRエンジン・モデルとその実行環境 | エンジンごとの導入手順で準備 |

Pythonの自動取得には初回のネット接続と、uvの自動ダウンロードが許可された設定が必要です。既に指定版があればそれを使います。AIにTEI readerやIIIF CLIの操作を依頼する場合は、ローカルコマンドを実行できるアプリを使います。画像をAIと読む場合は、画像読解にも対応したアプリを使います。

## TEI readerの環境を準備する

**TEI読解は、uvを導入してからreaderを起動するだけで、指定Pythonと専用環境を準備できます。** Pythonだけを入れた状態では、readerが呼び出すuvが不足します。既存のPythonとuvがある場合も、配布版が指定するPython 3.13.15を使えることが条件です。

1. [uvの公式導入手順](https://docs.astral.sh/uv/getting-started/installation/)に沿ってuvを導入します。
2. ターミナルを開き直し、次を実行します。通常のnpm導入を試すときは、cloneしたjp-lit repositoryの外の作業フォルダで実行してください。

```bash
uv --version
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-tei-reader --help
```

readerの初回起動で、uvが同梱の環境定義に従って専用環境を作ります。指定Pythonが見つからない場合は、[uvの既定の自動ダウンロード](https://docs.astral.sh/uv/guides/install-python/)で取得します。仮想環境やPythonライブラリを手で入れる必要はありません。npmやSkillsの導入時には、このTEI環境の準備は実行されません。

uvのバージョンとreaderのヘルプが表示されれば、起動を確認できています。AIアプリも開き直し、`jp-lit-tei` Skillとuvを使える状態で[TEIの読解](../tei-reader.md)を依頼します。

Pythonを先に準備したい場合は、通信できる環境で次を実行できます。自動ダウンロードを制限している環境でも、必要な版を事前に用意してください。

```bash
uv python install 3.13.15
```

初回のreader起動も通信できる状態で済ませると、npmパッケージと専用環境を確認できます。配布版のPythonは、既存の別バージョンと併存できます。

## IIIF比較画面を準備する

**IIIFの基本比較・領域選択・出典保存は、Pythonやuvを追加せずに使えます。** 同梱のViewerをWebブラウザで開きます。Node.jsとnpmが使える環境で、CLIの起動を確認できます。

```bash
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-iiif --help
```

ヘルプが表示されたら、[IIIFの使い方](../iiif-workbench.md)に沿ってAIに資料の選定と比較画面の起動を依頼します。CLIが返すローカルURLをブラウザで開きます。

画像をAIと読む場合も、まず利用中のアプリで画像を開きます。別のモデルやOCRサービスへ自動送信する設定はありません。

## 図版解析とくずし字OCRを追加する

図版の類似検索・整列・差分は、uvを用意し、[画像解析環境の導入](../iiif-workbench.md#似た図版を探し重ね合わせて確かめる)で`iiif-images.mjs --setup`を一度実行します。この明示操作で、PythonとOpenCVなどを取得し、専用環境を作ります。通常の解析はオフラインで動くため、事前のセットアップを済ませてください。

くずし字OCRには、標準の任意エンジンであるNDL古典籍OCR-Lite、または導入済みDocker/GPUを使う古典籍OCR ver.3を用意します。[OCRエンジンの導入案内](../iiif-workbench.md#くずし字ocrを使い画像と校合する)に沿って、エンジン・モデル・実行環境を別途準備します。PythonやSkillsを入れるだけでOCRエンジンが導入される仕組みはありません。

## MCPとSkillsの導入を確認する

MCP登録とSkills配置は、使うアプリの導入ガイドに沿って行います。

- [Codex App](codex-app.md)
- [Codex CLI](codex-cli.md)
- [Cursor](cursor.md)
- [Claude Code](claude-code.md)

`jp-lit-mcp doctor`はNode.js、同梱Skills、保存先などの基本確認を行います。TEI reader・画像解析・OCRの起動確認は各機能の手順で行ってください。基本機能だけを使う場合は、任意環境の準備を省いて文献調査を始められます。

## 準備でつまずいたとき

| 状態 | 確認すること |
| --- | --- |
| Pythonを入れたがTEI readerが起動しない | uvも導入し、`uv --version`を確認する。readerが指定するPython 3.13.15を準備できるか確かめる |
| ターミナルでは起動するがAIアプリで使えない | アプリを開き直し、uvを実行できる状態にする。Skillsの配置とローカルコマンドの実行権限も確認する |
| 初回のPython取得が止まる | ネット接続とuvのダウンロード設定を確認する。制限環境では指定版を事前に準備する |
| 比較画面は動くが図版解析が起動しない | 図版解析を行う導入先で`--setup`を済ませる。導入先ごとの環境の扱いはIIIFガイドで確認する |
| SkillsはあるがOCRが動かない | OCRエンジン・モデルを別途導入し、OCR手順の起動確認を済ませる |
