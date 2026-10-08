# TEI・IIIFの必要環境を準備する

`jp-lit-mcp`のnpmパッケージは、MCPサーバー、4つのSkills、TEI reader、IIIF CLIとViewerを同梱しています。TEI readerのPythonコードと環境定義も含みます。実行に使うNode.js、uv、Pythonは利用者のPCで準備します。

## 機能ごとの必要環境

| 使う機能 | 必要な環境 |
| --- | --- |
| MCPによる文献検索 | Node.js 22以上、npm、MCP対応AIアプリ |
| TEI readerによる保存XMLの読解 | Node.js 22以上、npm、uv、Python 3.13.15 |
| IIIF比較画面と出典保存 | Node.js 22以上、npm、Webブラウザ。Viewerは同梱済み。 |
| IIIFとTEI本文の対応付け | IIIFの環境に加え、TEI readerの環境 |
| 保存図版の類似検索・整列・差分 | IIIFの環境に加え、uvとPython 3.13系の画像解析環境 |
| ローカルくずし字OCR | IIIFの環境に加え、選ぶOCRエンジンの実行環境とモデル |

AIにTEI readerやIIIF CLIの操作を依頼する場合は、ローカルコマンドを実行できるアプリを使います。画像をAIと読む場合は、画像読解にも対応したアプリを使います。Skillsは操作手順をAIへ渡し、実行環境の導入は次の手順で行います。

## TEI readerの環境を準備する

初めに[uvの公式導入手順](https://docs.astral.sh/uv/getting-started/installation/)に沿ってuvを導入します。導入後にターミナルを開き直し、次を実行します。通常のnpm導入を試すときは、cloneしたjp-lit repositoryの外の作業フォルダで実行してください。

```bash
uv --version
uv python install 3.13.15
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-tei-reader --help
```

uvのバージョンとreaderのヘルプが表示されれば、起動を確認できています。Pythonは[uvで指定版を導入](https://docs.astral.sh/uv/guides/install-python/)できます。readerの起動時には、同梱の環境定義に従ってuvが専用環境を作るため、仮想環境を手で作る必要はありません。初回にはnpmパッケージやPythonのダウンロードが発生することがあります。

TEI readerはPython 3.13系に対応し、配布版の指定は3.13.15です。既存の別バージョンのPythonと併存できます。導入後はAIアプリも開き直し、uvを実行できる状態で[TEIの読解](../tei-reader.md)を依頼します。

## IIIF比較画面を準備する

基本の比較画面は、同梱のViewerをWebブラウザで開いて使います。Node.jsとnpmが使える環境で、CLIの起動を確認できます。

```bash
npx --yes --package=jp-lit-mcp@0.18.0 jp-lit-iiif --help
```

ヘルプが表示されたら、[IIIFの使い方](../iiif-workbench.md)に沿ってAIに資料の選定と比較画面の起動を依頼します。CLIが返すローカルURLをブラウザで開きます。

図版の類似検索・整列・差分は、[画像解析環境の導入](../iiif-workbench.md#似た図版を探し重ね合わせて確かめる)を追加で行います。Python環境とOpenCVなどの依存関係をuvで準備します。くずし字OCRは、[OCRエンジンの導入案内](../iiif-workbench.md#くずし字ocrを使い画像と校合する)を参照してください。

## MCPとSkillsの導入を確認する

MCP登録とSkills配置は、使うアプリの導入ガイドに沿って行います。

- [Codex App](codex-app.md)
- [Codex CLI](codex-cli.md)
- [Cursor](cursor.md)
- [Claude Code](claude-code.md)

`install-skills`や`gh skill install`はSkillsを配置します。uvとPythonの導入は上の手順で行います。`jp-lit-mcp doctor`はNode.js、同梱Skills、保存先などの基本確認を行います。TEI reader・画像解析・OCRの起動確認は各機能の手順で行ってください。
