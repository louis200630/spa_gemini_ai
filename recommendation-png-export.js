/* PNG export for the quick recommendation list.
 * Browser-only Canvas renderer: no runtime dependency or server write.
 * Product selection, description edits, and image data remain owned by simple-recommendations.js.
 */
'use strict';
(() => {
  const W = 1240, H = 1754, PAD = 56, GAP = 18, FOOTER_TOP = 1668;
  const FONT = '"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif';
  const MAX_DPR = 2;
  const enc = new TextEncoder();
  const filenameDate = () => new Date().toLocaleDateString('sv-SE');

  function font(size, weight = 400) { return weight + ' ' + size + 'px ' + FONT; }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
    }
    ctx.closePath();
  }
  function linesFor(ctx, value, width) {
    const result = [];
    const paragraphs = String(value ?? '').replace(/\r/g, '').split('\n');
    for (const p of paragraphs) {
      if (!p) { result.push(''); continue; }
      let current = '';
      for (const ch of p) {
        if (current && ctx.measureText(current + ch).width > width) {
          result.push(current); current = ch;
        } else current += ch;
      }
      result.push(current);
    }
    return result.length ? result : [''];
  }
  function plan(items) {
    const probe = document.createElement('canvas').getContext('2d');
    const xText = PAD + 24 + 178 + 24;
    const textWidth = W - PAD - 24 - xText;
    const pages = [];
    let page = [], y = 180;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      probe.font = font(20, 500);
      const brand = linesFor(probe, item.brand, textWidth);
      probe.font = font(30, 700);
      const title = linesFor(probe, item.name, textWidth);
      probe.font = font(23, 700);
      const price = linesFor(probe, item.price, textWidth);
      probe.font = font(21, 400);
      const desc = linesFor(probe, item.description, textWidth);
      // Rows are measured with the same font and line height used by paint().
      const textHeight = brand.length*27 + title.length*40 + price.length*33 + desc.length*30 + 57;
      const height = Math.max(258, textHeight + 34);
      if (height > FOOTER_TOP - 180) throw new Error('單項產品描述超出圖片頁面高度，請縮短內容');
      if (page.length && y + height + GAP > FOOTER_TOP) {
        pages.push(page);
        page = [];
        y = 180;
      }
      page.push({ ...item, index:i+1, height, brand, title, price, desc });
      y += height + GAP;
    }
    if (page.length) pages.push(page);
    return { pages, xText, textWidth };
  }
  function drawText(ctx, textLines, x, y, size, weight, color, lineH) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    for (const t of textLines) { ctx.fillText(t, x, y); y += lineH; }
    return y;
  }
  async function decodePhoto(src) {
    if (!src) return null;
    try {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    } catch { return null; }
  }
  function drawPage(ctx, rows, pageNo, pageCount, total, imageMap, xText) {
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#183e3d';ctx.font=font(42,700);
    ctx.fillText('快速產品推薦清單',PAD,70);
    ctx.fillStyle='#698083';ctx.font=font(20,500);
    ctx.fillText('為您推薦的產品・共 '+total+' 項・第 '+pageNo+'/'+pageCount+' 頁',PAD,110);
    ctx.fillText('產生日期：'+new Date().toLocaleDateString('zh-TW'),PAD,140);
    let y=180;
    for (const row of rows) {
      rounded(ctx,PAD,y,W-2*PAD,row.height,18);
      ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#dce8e5';ctx.lineWidth=2;ctx.stroke();

      const boxX=PAD+24, boxY=y+59, boxS=178;
      rounded(ctx,boxX,boxY,boxS,boxS,12);
      ctx.fillStyle='#f2f6f5';ctx.fill();

      const image=imageMap.get(row.image);
      if(image){
        const scale=Math.min((boxS-10)/image.naturalWidth,(boxS-10)/image.naturalHeight);
        const drawW=image.naturalWidth*scale, drawH=image.naturalHeight*scale;
        ctx.drawImage(image,boxX+(boxS-drawW)/2,boxY+(boxS-drawH)/2,drawW,drawH);
      } else {
        ctx.font=font(18,500);ctx.fillStyle='#91a3a7';ctx.textAlign='center';
        ctx.fillText('圖片待補',boxX+boxS/2,boxY+boxS/2+6);ctx.textAlign='start';
      }
      ctx.font=font(17,700);ctx.fillStyle='#137a6e';
      ctx.fillText(String(row.index).padStart(2,'0'),boxX+6,y+42);

      let ty=y+43;
      ty=drawText(ctx,row.brand,xText,ty,20,500,'#788b90',27);
      ty+=5;
      ty=drawText(ctx,row.title,xText,ty,30,700,'#223c41',40);
      ty+=2;
      ty=drawText(ctx,row.price,xText,ty,23,700,'#16695d',33);
      ty+=17;
      drawText(ctx,row.desc,xText,ty,21,400,'#53696d',30);
      y+=row.height+GAP;
    }
    ctx.strokeStyle='#dce7e5';ctx.beginPath();
    ctx.moveTo(PAD,FOOTER_TOP+12);ctx.lineTo(W-PAD,FOOTER_TOP+12);ctx.stroke();
    ctx.fillStyle='#75898c';ctx.font=font(17,400);
    ctx.fillText('本清單供產品介紹及選購參考，實際商品資訊與價格請以台灣官方網站為準。',PAD,FOOTER_TOP+48);
  }
  function pngBlob(canvas) {
    return new Promise((resolve,reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法產生 PNG')), 'image/png'));
  }
  function download(blob,name) {
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  }

  // Store (uncompressed) PNGs in one standards-compliant ZIP, without libraries.
  function zipFiles(files) {
    const u16=(a,n)=>{a.push(n&255,(n>>>8)&255);};
    const u32=(a,n)=>{a.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);};
    const crc=(data)=>{
      let c=0xffffffff;
      for(const x of data) { c^=x;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0); }
      return (c^0xffffffff)>>>0;
    };
    let offset=0;
    const chunks=[],central=[];
    for(const entry of files){
      const name=enc.encode(entry.name), bytes=entry.bytes, sum=crc(bytes);
      const local=[];
      u32(local,0x04034b50);u16(local,20);u16(local,0x0800);u16(local,0);
      u16(local,0);u16(local,0);u32(local,sum);u32(local,bytes.length);
      u32(local,bytes.length);u16(local,name.length);u16(local,0);
      chunks.push(new Uint8Array(local),name,bytes);
      const dir=[];
      u32(dir,0x02014b50);u16(dir,20);u16(dir,20);u16(dir,0x0800);
      u16(dir,0);u16(dir,0);u16(dir,0);u32(dir,sum);u32(dir,bytes.length);
      u32(dir,bytes.length);u16(dir,name.length);u16(dir,0);u16(dir,0);
      u16(dir,0);u16(dir,0);u32(dir,0);u32(dir,offset);
      central.push(new Uint8Array(dir),name);
      offset+=local.length+name.length+bytes.length;
    }
    const centralSize=central.reduce((n,b)=>n+b.length,0);
    const end=[];
    u32(end,0x06054b50);u16(end,0);u16(end,0);
    u16(end,files.length);u16(end,files.length);
    u32(end,centralSize);u32(end,offset);u16(end,0);
    return new Blob([...chunks,...central,new Uint8Array(end)],{type:'application/zip'});
  }

  async function exportList(items){
    if(!items.length) throw new Error('請先勾選產品');
    await document.fonts?.ready;
    const {pages,xText}=plan(items);
    const images=new Map();
    const sources=[...new Set(items.map(p=>p.image).filter(Boolean))];
    await Promise.all(sources.map(async src=>images.set(src,await decodePhoto(src))));
    const filename='快速產品推薦清單-'+filenameDate();
    const files=[];
    for(let i=0;i<pages.length;i++){
      const canvas=document.createElement('canvas');
      const scale=MAX_DPR;
      canvas.width=W*scale;canvas.height=H*scale;
      const ctx=canvas.getContext('2d');
      if(!ctx) throw new Error('瀏覽器無法建立圖片畫布');
      ctx.scale(scale,scale);
      drawPage(ctx,pages[i],i+1,pages.length,items.length,images,xText);
      const blob=await pngBlob(canvas);
      if(pages.length===1){
        download(blob,filename+'.png');
      } else {
        files.push({name:filename+'-第'+String(i+1).padStart(2,'0')+'頁.png',
          bytes:new Uint8Array(await blob.arrayBuffer())});
      }
      canvas.width=1;canvas.height=1;
    }
    if(files.length>1) download(zipFiles(files),filename+'-'+files.length+'頁.zip');
    return pages.length;
  }

  window.RecommendationPng={exportList};
})();
