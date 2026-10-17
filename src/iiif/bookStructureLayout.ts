import { XMLParser, XMLValidator } from "fast-xml-parser";
import { structureId, type BookPage, type BookRegion } from "./bookStructureSchemas.js";

function kind(type: string): BookRegion["kind"] {
  if (/キャプション|caption|説明文/i.test(type)) return "caption";
  if (/表|table/i.test(type)) return "table";
  if (/図|写真|figure|image|illustration/i.test(type)) return "figure";
  if (/見出し|柱|heading|header/i.test(type)) return "heading";
  if (/注|note/i.test(type)) return "note";
  if (/本文|text/i.test(type)) return "text";
  return "unknown";
}
export function imageToCanvas(rect: [number,number,number,number], page: BookPage): [number,number,number,number] {
  const [px,py,pw,ph] = page.canvas_xywh!, [x,y,w,h] = rect;
  return [px+x*pw/page.image_width!,py+y*ph/page.image_height!,w*pw/page.image_width!,h*ph/page.image_height!];
}

/** 原XMLの非文字領域も保持する。polygonの外接矩形を画像対応に用いる。 */
export function parseBookLayout(xml: string, page: BookPage): BookRegion[] {
  if (Buffer.byteLength(xml)>10*1024*1024 || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml) || XMLValidator.validate(xml)!==true)
    throw Error("layout XMLの形式・容量を確認してください");
  const tree = new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:"",parseAttributeValue:false,trimValues:false}).parse(xml);
  const roots = tree.filter((n:any)=>!Object.keys(n)[0].startsWith("?"));
  const pages = roots[0]?.OCRDATASET?.filter((n:any)=>n.PAGE);
  if (roots.length!==1 || pages?.length!==1) throw Error("layout XMLは単一PAGEを指定してください");
  const attrs=pages[0][":@"]??{};
  if (Number(attrs.WIDTH)!==page.image_width || Number(attrs.HEIGHT)!==page.image_height || page.coverage!=="ready")
    throw Error("layout XMLと入力画像の寸法が一致しません");
  const result:BookRegion[]=[];let count=0;
  function walk(nodes:any[], parent:string, depth:number) {
    if(depth>64)throw Error("layout XMLが深すぎます");
    const counters=new Map<string,number>();
    for(const node of nodes) {
      if(++count>50000)throw Error("layout XMLの要素数が上限を超えます");
      const name=Object.keys(node).find(k=>k!==":@")!;if(name.startsWith("#")||name.startsWith("?"))continue;
      const nth=(counters.get(name)??0)+1;counters.set(name,nth);const xpath=`${parent}/${name}[${nth}]`, a=node[":@"]??{};
      const regionKind=kind(String(a.TYPE??""));
      if(name==="BLOCK"||name==="TEXTBLOCK"||(name==="LINE"&&["caption","heading","note"].includes(regionKind))) {
        const shape=(node[name]??[]).find((n:any)=>n.SHAPE)?.SHAPE;
        const pointText=shape?.find((n:any)=>n.POLYGON)?.[":@"]?.POINTS;
        let polygon:number[]|null=null, box:[number,number,number,number]|null=null;
        if(pointText!==undefined) {
          const parts=String(pointText).trim().split(/[\s,]+/);
          if(parts.length<6||parts.length%2||parts.some(s=>!s||!Number.isFinite(Number(s))))throw Error("layout polygonの数値が不正です");
          polygon=parts.map(Number);const xs=polygon.filter((_,i)=>i%2===0),ys=polygon.filter((_,i)=>i%2===1);
          box=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];
        } else if(["X","Y","WIDTH","HEIGHT"].every(k=>a[k]!==undefined)) box=[Number(a.X),Number(a.Y),Number(a.WIDTH),Number(a.HEIGHT)];
        if(box) {
          const [x,y,w,h]=box;
          if(!box.every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>page.image_width!||y+h>page.image_height!)throw Error("layout領域が画像の外にあります");
          result.push({region_id:structureId("region",page.page_id,page.image_sha256,xpath),page_id:page.page_id,kind:regionKind,
            image_xywh:box,canvas_xywh:imageToCanvas(box,page),line_refs:[],origin:"ocr_layout",source_locator:{xpath,type:a.TYPE??null,polygon}});
        }
      }
      if(Array.isArray(node[name]))walk(node[name],xpath,depth+1);
    }
  }
  walk(pages[0].PAGE,"/OCRDATASET[1]/PAGE[1]",0);return result;
}
