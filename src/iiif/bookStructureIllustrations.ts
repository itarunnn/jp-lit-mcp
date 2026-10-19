import { structureId, type BookRegion, type BookUnit, type BookPage } from "./bookStructureSchemas.js";

type Rect = [number, number, number, number];
function overlap(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])) *
    Math.max(0, Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));
}

export function enclosesIllustration(outer: BookRegion, inner: BookRegion): boolean {
  const a=outer.image_xywh,b=inner.image_xywh;
  return !!a && !!b && outer.page_id===inner.page_id && a[2]*a[3]>b[2]*b[3]*1.2 && overlap(a,b)/(b[2]*b[3])>=.95;
}

/** ほぼ同じ範囲の再検出をまとめ、すべての原領域を参照する。部分図は独立して保持する。 */
export function illustrationUnits(regions: BookRegion[], groupDuplicates: boolean): BookUnit[] {
  const groups: BookRegion[][] = [];
  for (const region of regions.filter(r=>r.kind==="figure"||r.kind==="table")) {
    const group = groupDuplicates && region.image_xywh ? groups.find(g=>g.every(other=>{
      if(other.page_id!==region.page_id||other.kind!==region.kind||!other.image_xywh)return false;
      const intersection=overlap(region.image_xywh!,other.image_xywh);
      const union=region.image_xywh![2]*region.image_xywh![3]+other.image_xywh[2]*other.image_xywh[3]-intersection;
      return intersection/union>=.9;
    })) : undefined;
    if(group)group.push(region);else groups.push([region]);
  }
  return groups.map(group=>({unit_id:structureId("unit",group[0].region_id),kind:group[0].kind==="table"?"table":"figure",
    region_ids:group.map(r=>r.region_id),span_ids:[],fields:[]}));
}

export function isLongVerticalBody(box: Rect|null, page: BookPage): boolean {
  return !!box && box[3]>box[2]*4 && box[3]>page.image_height!*.15;
}

/** 説明文と図の辺の間隔・軸方向の重なりを確認し、近い候補間の競合を保持する。 */
export function captionGeometry(caption: Rect, figure: Rect, page: BookPage): {distance:number;gap:number;side:string}|null {
  const [x,y,w,h]=figure,[lx,ly,lw,lh]=caption;
  const horizontal=lw>=lh;
  const axisOverlap=horizontal ? Math.min(x+w,lx+lw)-Math.max(x,lx) : Math.min(y+h,ly+lh)-Math.max(y,ly);
  const axisSize=horizontal ? Math.min(w,lw) : Math.min(h,lh);
  if(axisOverlap<axisSize*.4)return null;
  const gap=horizontal ? Math.max(0,y-ly-lh,ly-y-h) : Math.max(0,x-lx-lw,lx-x-w);
  const limit=horizontal ? Math.max(lh*4,page.image_height!*.1) : Math.max(lw*4,page.image_width!*.1);
  if(gap>limit)return null;
  const distance=Math.hypot(lx+lw/2-x-w/2,ly+lh/2-y-h/2)/Math.hypot(page.image_width!,page.image_height!);
  const side=horizontal ? ly+lh<=y?"above":y+h<=ly?"below":"inside" : lx+lw<=x?"left":x+w<=lx?"right":"inside";
  return distance<=.4 ? {distance,gap,side} : null;
}
