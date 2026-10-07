# IIIF領域画像の任意ローカル解析

保存済みJPEG/PNGの局所特徴を使い、形の対応候補と位置合わせ後の差を計算します。原画像と本文を保持し、図版の意味・文字異同・史料上の同一性は人の確認として別に記録します。

uvとPython3.13を使います。環境はpackage外に置き、準備時に固定lockの依存を導入します。

```powershell
$env:UV_PROJECT_ENVIRONMENT = 'J:\Caches\jp-lit-iiif-images'
uv sync --frozen --no-dev --project packages/iiif-image-analysis
npm run test:images
```

OpenCV-headlessはCPU専用、numpyは配列計算に使います。通常のMCP・比較画面はこの環境を要求しません。解析実行時はoffline/frozenで追加取得を止めます。依存の固定版とhashはuv.lockに保存しています。

解析はencoded画素の向きを使い、長辺1024pxに縮小します。ORB/RANSACの平行移動・回転・等方倍率で対応を確認し、局所だけの一致・重なり不足・低特徴は保留します。透視・紙の湾曲・図像主題の類似は別の方式が必要です。

原濃淡の差と、共通範囲の2/98percentileで濃淡を調整した差を併記します。差分の赤は25/255を超える画素差、灰は比較範囲外です。画像の解像度・補間・紙色・照明の影響が残るため、数値は学術的な異同や確率を表しません。詳しい操作は[IIIFガイド](../../docs/iiif-workbench.md)を参照してください。
