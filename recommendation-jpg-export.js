/* Long JPG export for the quick recommendation list.
 * Draws all chosen products in ONE vertically scrolling image.
 * Browser-only Canvas; no ZIP and no changes to the product database.
 */
'use strict';
(() => {
  const WIDTH = 1240;
  const SIDE = 56;
  const TOP = 176;
  const GAP = 18;
  const CARD_PAD = 24;
  const PHOTO_SIZE = 178;
  const FOOTER = 94;
  const MAX_CSS_HEIGHT = 22000;
  const MAX_CANVAS_EDGE = 16000;
  const MAX_CANVAS_PIXELS = 14000000;
  const FONT = '"Noto Sans TC","Microsoft JhengHei",Arial,sans-serif';

  const font = (px, weight = 400) => weight + ' ' + px + 'px ' + FONT;
  const filenameDate = () => new Date().toLocaleDateString('sv-SE');

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
      ctx.quadraticCurveTo(x+w, y, x+w, y+r);
      ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
      ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
      ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    }
    ctx.closePath();
  }

  function wrap(ctx, raw, maxWidth) {
    const result = [];
    for (const paragraph of String(raw ?? '').replace(/\r/g, '').split('\n')) {
      if (!paragraph) { result.push(''); continue; }
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          result.push(line);
          line = char;
        } else line += char;
      }
      result.push(line);
    }
    return result.length ? result : [''];
  }

  function plan(items) {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) throw new Error('無法使用瀏覽器繪圖功能');
    const textX = SIDE + CARD_PAD + PHOTO_SIZE + 24;
    const textWidth = WIDTH - SIDE - CARD_PAD - textX;
    const rows = [];
    let y = TOP;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      probe.font = font(20, 500);
      const brandLines = wrap(probe, item.brand, textWidth);
      probe.font = font(30, 700);
      const titleLines = wrap(probe, item.name, textWidth);
      probe.font = font(23, 700);
      const priceLines = wrap(probe, item.price, textWidth);
      probe.font = font(21, 400);
      const descriptionLines = wrap(probe, item.description, textWidth);
      const contentHeight =
        43 + brandLines.length * 27 + 5 + titleLines.length * 40 + 2 +
        priceLines.length * 33 + 17 + descriptionLines.length * 30 + 20;
      const height = Math.max(258, contentHeight, PHOTO_SIZE + 83);
      rows.push({
        ...item, index: i + 1, y, height,
        brandLines, titleLines, priceLines, descriptionLines
      });
      y += height + GAP;
    }
    return { rows, height: y - GAP + FOOTER, textX };
  }

  function drawLines(ctx, lines, x, y, px, weight, color, lineHeight) {
    ctx.font = font(px, weight);
    ctx.fillStyle = color;
    for (const line of lines) { ctx.fillText(line, x, y); y += lineHeight; }
    return y;
  }

  async function decodeImage(src) {
    if (!src) return null;
    try {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    } catch { return null; }
  }

  function paint(ctx, rows, totalHeight, textX, images) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, WIDTH, totalHeight);
    ctx.font = font(42, 700);
    ctx.fillStyle = '#183e3d';
    ctx.fillText('快速產品推薦清單', SIDE, 70);
    ctx.fillStyle = '#698083';
    ctx.font = font(20, 500);
    ctx.fillText('為您推薦的產品・共 ' + rows.length + ' 項', SIDE, 110);
    ctx.fillText('產生日期：' + new Date().toLocaleDateString('zh-TW'), SIDE, 140);

    for (const item of rows) {
      const y = item.y;
      roundRect(ctx, SIDE, y, WIDTH - SIDE * 2, item.height, 18);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#dce8e5';
      ctx.lineWidth = 2;
      ctx.stroke();

      const imageX = SIDE + CARD_PAD;
      const imageY = y + 59;
      roundRect(ctx, imageX, imageY, PHOTO_SIZE, PHOTO_SIZE, 12);
      ctx.fillStyle = '#f2f6f5';
      ctx.fill();
      const image = images.get(item.image);
      if (image) {
        const zoom = Math.min(
          (PHOTO_SIZE - 12) / image.naturalWidth,
          (PHOTO_SIZE - 12) / image.naturalHeight
        );
        const w = image.naturalWidth * zoom;
        const h = image.naturalHeight * zoom;
        ctx.drawImage(image,
          imageX + (PHOTO_SIZE - w) / 2,
          imageY + (PHOTO_SIZE - h) / 2, w, h);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#91a3a7';
        ctx.font = font(18, 500);
        ctx.fillText('圖片待補', imageX + PHOTO_SIZE / 2, imageY + PHOTO_SIZE / 2 + 6);
        ctx.textAlign = 'start';
      }

      ctx.fillStyle = '#137a6e';
      ctx.font = font(17, 700);
      ctx.fillText(String(item.index).padStart(2, '0'), imageX + 6, y + 42);

      let ty = y + 43;
      ty = drawLines(ctx, item.brandLines, textX, ty, 20, 500, '#788b90', 27);
      ty += 5;
      ty = drawLines(ctx, item.titleLines, textX, ty, 30, 700, '#223c41', 40);
      ty += 2;
      ty = drawLines(ctx, item.priceLines, textX, ty, 23, 700, '#16695d', 33);
      ty += 17;
      drawLines(ctx, item.descriptionLines, textX, ty, 21, 400, '#53696d', 30);
    }

    ctx.strokeStyle = '#dce7e5';
    ctx.beginPath();
    ctx.moveTo(SIDE, totalHeight - 80);
    ctx.lineTo(WIDTH - SIDE, totalHeight - 80);
    ctx.stroke();
    ctx.fillStyle = '#75898c';
    ctx.font = font(17, 400);
    ctx.fillText('本清單供產品介紹及選購參考，實際商品資訊與價格請以台灣官方網站為準。',
      SIDE, totalHeight - 42);
  }

  function jpegBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob && blob.type === 'image/jpeg' && blob.size > 0) resolve(blob);
        else reject(new Error('手機或瀏覽器未能產生 JPG，請縮短清單後再試'));
      }, 'image/jpeg', 0.91);
    });
  }

  function download(blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '快速產品推薦清單-' + filenameDate() + '.jpg';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportList(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('請先勾選產品');
    if (document.fonts?.ready) await document.fonts.ready;

    const layout = plan(items);
    if (layout.height > MAX_CSS_HEIGHT)
      throw new Error('清單太長，手機無法一次匯出；請減少產品數或縮短描述後再試');

    // Restrict output dimensions/pixel count to avoid silent canvas failure on mobile.
    const scale = Math.min(
      2,
      MAX_CANVAS_EDGE / Math.max(WIDTH, layout.height),
      Math.sqrt(MAX_CANVAS_PIXELS / (WIDTH * layout.height))
    );
    if (scale < 0.68)
      throw new Error('這份清單太長，超過手機長圖限制。請減少產品項目或縮短說明');
    const pixelWidth = Math.max(1, Math.floor(WIDTH * scale));
    const pixelHeight = Math.max(1, Math.floor(layout.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此瀏覽器無法建立長圖，請縮短清單再試');

    const sources = [...new Set(items.map(p => p.image).filter(Boolean))];
    const images = new Map();
    await Promise.all(sources.map(async src => images.set(src, await decodeImage(src))));
    ctx.scale(pixelWidth / WIDTH, pixelHeight / layout.height);
    paint(ctx, layout.rows, layout.height, layout.textX, images);
    const blob = await jpegBlob(canvas);
    canvas.width = 1; canvas.height = 1;
    download(blob);
    return 1;
  }

  window.RecommendationJpg = { exportList };
})();
