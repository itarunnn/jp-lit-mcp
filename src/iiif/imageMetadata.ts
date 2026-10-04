export function imageDimensions(bytes: Uint8Array): { width: number; height: number; format: 'jpg' | 'png' } {
  const b = Buffer.from(bytes);
  if (b.length>=24 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii',12,16)==='IHDR') {
    const width=b.readUInt32BE(16), height=b.readUInt32BE(20); if(width&&height) return {width,height,format:'png'};
  }
  if(b[0]===255 && b[1]===216) {
    let offset=2;
    while(offset+4<=b.length) {
      if(b[offset++]!==255) break;
      while(b[offset]===255) offset++;
      const marker=b[offset++];
      if(marker===217 || marker===218) break;
      if(marker===1 || (marker>=208&&marker<=215)) continue;
      const size=b.readUInt16BE(offset); if(size<2 || offset+size>b.length) break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size>=8) { const height=b.readUInt16BE(offset+3),width=b.readUInt16BE(offset+5);if(width&&height) return {width,height,format:'jpg'}; }
      offset+=size;
    }
  }
  throw new Error('画像寸法を確認できません。初版はJPEG/PNGを扱います');
}
