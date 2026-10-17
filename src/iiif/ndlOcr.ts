import { XMLParser, XMLValidator } from "fast-xml-parser";
import { normalizeKotenOutput } from "./ocr.js";
import type { OcrSource } from "./ocrSchemas.js";

/** NDLOCR 2.1の元XMLから、幾何変換を加えず行候補を導出する。 */
export function parseNdlOcrXml(xml: string, source: OcrSource, imageName: string) {
  if (Buffer.byteLength(xml) > 10 * 1024 * 1024 || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("NDLOCR原XMLの形式・容量を確認してください");
  const tree = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", trimValues: false, parseAttributeValue: false }).parse(xml);
  type Node = Record<string, any>;
  const roots = tree.filter((n: Node) => !Object.keys(n)[0].startsWith("?"));
  if (roots.length !== 1 || !roots[0].OCRDATASET) throw new Error("NDLOCR原XMLのrootが不正です");
  const pages = roots[0].OCRDATASET.filter((n: Node) => n.PAGE);
  if (pages.length !== 1) throw new Error("NDLOCR原XMLは単一画像のPAGEを指定してください");
  const page = pages[0], a = page[":@"] ?? {};
  const number = (value: unknown) => {
    if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) throw new Error("NDLOCR原XMLの数値が不正です");
    return Number(value);
  };
  if (number(a.WIDTH) !== source.image_width || number(a.HEIGHT) !== source.image_height || a.IMAGENAME !== imageName) throw new Error("NDLOCR原XMLの入力画像・寸法が一致しません");
  const entries: { id: string; text: string; boundingBox: [number, number][]; confidence?: number; native: { element: string; xml_path: string; type: string | null; order: number | null; title: string | null; author: string | null } }[] = [];
  let count = 0; const orders = new Set<number>();
  function walk(nodes: Node[], parent: string, depth: number) {
    if (depth > 64) throw new Error("NDLOCR原XMLの深さが上限を超えます");
    const counters = new Map<string, number>();
    for (const node of nodes) {
      if (++count > 50000) throw new Error("NDLOCR原XMLの要素数が上限を超えます");
      const name = Object.keys(node).find(k => k !== ":@")!;
      if (name.startsWith("#") || name.startsWith("?")) continue;
      const nth = (counters.get(name) ?? 0) + 1; counters.set(name, nth);
      const locator = `${parent}/${name}[${nth}]`, attrs = node[":@"] ?? {};
      if (name === "LINE" && typeof attrs.STRING !== "string") throw new Error("NDLOCR原XMLに未認識のLINEがあります");
      if ((name === "LINE" || name === "BLOCK") && typeof attrs.STRING === "string") {
        const x = number(attrs.X), y = number(attrs.Y), w = number(attrs.WIDTH), h = number(attrs.HEIGHT);
        if (x < 0 || y < 0 || w <= 0 || h <= 0) throw new Error("NDLOCR原XMLの矩形が不正です");
        const order = attrs.ORDER === undefined ? null : number(attrs.ORDER);
        if (order !== null && (!Number.isInteger(order) || order < 0 || orders.has(order))) throw new Error("NDLOCR原XMLのORDERが重複または不正です");
        if (order !== null) orders.add(order);
        const confidence = attrs.CONF === undefined ? undefined : number(attrs.CONF);
        entries.push({ id: String(entries.length), text: attrs.STRING, boundingBox: [[x,y],[x,y+h],[x+w,y],[x+w,y+h]], ...(confidence === undefined ? {} : { confidence }),
          native: { element: name, xml_path: locator, type: attrs.TYPE ?? null, order, title: attrs.TITLE ?? null, author: attrs.AUTHOR ?? null } });
        if (entries.length > 10000) throw new Error("NDLOCR原XMLの認識行数が上限を超えます");
      }
      if (Array.isArray(node[name])) walk(node[name], locator, depth + 1);
    }
  }
  walk(page.PAGE, "/OCRDATASET[1]/PAGE[1]", 1);
  entries.sort((a, b) => (a.native.order ?? Infinity) - (b.native.order ?? Infinity) || Number(a.id) - Number(b.id));
  const raw = { source_format: "ndlocr-2.1-xml", reading_order: "ORDER_then_unordered_XML", imginfo: { img_name: imageName, img_width: source.image_width, img_height: source.image_height }, contents: [entries] };
  const lines = normalizeKotenOutput(raw, source), text = entries.length ? entries.map(l => l.text).join("\n") + "\n" : "";
  return { raw, text, lines };
}

export function validateNdlOcrOutput(xml: string, raw: unknown, text: string, source: OcrSource, imageName: string) {
  const expected = parseNdlOcrXml(xml, source, imageName);
  if (JSON.stringify(raw) !== JSON.stringify(expected.raw) || text !== expected.text) throw new Error("NDLOCR原XMLと導出JSON・TXTが一致しません");
  return expected.lines;
}
