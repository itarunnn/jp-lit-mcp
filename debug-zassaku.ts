import { projectNdlSearchOpenSearchXml } from "./src/sources/ndlSearch/projectOpenSearch.js";
import { mapNdlSearchSearchResponse } from "./src/sources/ndlSearch/mapSearch.js";

const res = await fetch("https://ndlsearch.ndl.go.jp/api/opensearch?any=%E5%A4%8F%E7%9B%AE%E6%BC%B1%E7%9F%B3&dpid=zassaku&cnt=1");
const xml = await res.text();
const projected = projectNdlSearchOpenSearchXml(xml);
console.log("projected.items[0]:", JSON.stringify(projected.items[0], null, 2));
const result = mapNdlSearchSearchResponse(projected);
console.log("search result:", JSON.stringify(result.items[0], null, 2));
