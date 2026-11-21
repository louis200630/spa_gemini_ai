'use strict';
(() => {
  const catalog = (window.RECOMMENDATION_PRODUCTS || []).filter(p => p && /^P\d{3,4}$/.test(p.id) && p.name);
  const byId = new Map(catalog.map(p => [p.id, p]));
  const storageKey = 'ma-simple-recommendations-v1';
  const get = id => document.getElementById(id);
  const picker = get('productPicker');
  const selectedItems = get('selectedItems');
  const photoData = new Map();
  const pendingPhotos = new Map();
  let approvedIds = new Set();
  let cloudReady = false;
  let cloudConnected = false;
  let ids = [];

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) ids = [...new Set(saved.filter(id => byId.has(id)))];
  } catch {}

  // Consultant-only edits: neither source products nor cloud images are modified.
  const editsKey = 'ma-simple-recommendation-descriptions-v1';
  let edits = Object.create(null);
  try {
    const data = JSON.parse(localStorage.getItem(editsKey) || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [id, value] of Object.entries(data)) if (byId.has(id) && typeof value === 'string') edits[id] = value.slice(0, 400);
    }
  } catch {}
  function preset(p) {
    const head = String(p.headline || '').trim();
    const brief = String(p.brief || '').trim().replace(/\s+/g, ' ');
    const expandedDefaults = new Set(['P007', 'P049', 'P069', 'P070', 'P071', 'P072', 'P073', 'P074', 'P075', 'P076', 'P077', 'P078', 'P079', 'P080', 'P081', 'P082', 'P083', 'P084', 'P085', 'P086', 'P087', 'P088', 'P089', 'P090', 'P091', 'P092', 'P093', 'P094', 'P095', 'P096', 'P097', 'P098', 'P118', 'P123', 'P126', 'P132', 'P136']);
    if (expandedDefaults.has(p.id)) return head ? '【' + head + '】 ' + brief : brief;
    const stop = brief.search(/[。！？]/);
    let first = stop < 0 ? brief : brief.slice(0, stop + 1);
    if ([...first].length > 88) first = [...first].slice(0, 88).join('').replace(/[，、；。\s]+$/, '') + '…';
    const label = head === '產品介紹' ? '' : head;
    return label && first && label !== first ? label + '：' + first : (label || first);
  }
  const descriptionOf = p => Object.prototype.hasOwnProperty.call(edits, p.id) ? edits[p.id] : preset(p);
  const persistEdits = () => { try { localStorage.setItem(editsKey, JSON.stringify(edits)); } catch {} };
  const priceOf = p => 'NT$' + (Number(p.price) || 0).toLocaleString('zh-TW');

  get('catalogCount').textContent = catalog.length + ' 項';
  const toast = message => {
    const element = get('toast');
    element.textContent = message;
    element.style.display = 'block';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { element.style.display = 'none'; }, 3000);
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch {} };
  const clean = value => String(value || '').toLocaleLowerCase().normalize('NFKC');

  function renderPicker() {
    const term = clean(get('productSearch').value.trim());
    const scroll = picker.scrollTop;
    const matches = catalog.filter(p =>
      !term || clean(p.id + ' ' + (p.code || '') + ' ' + p.name + ' ' + p.brand).includes(term)
    );
    get('filterCount').textContent = term ? '找到 ' + matches.length + ' 項' : '';
    const fragment = document.createDocumentFragment();
    for (const product of matches) {
      const label = document.createElement('label');
      label.className = 'productOption' + (ids.includes(product.id) ? ' chosen' : '');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = ids.includes(product.id);
      check.dataset.id = product.id;
      check.setAttribute('aria-label', '選擇 ' + product.name);
      const content = document.createElement('span');
      content.className = 'productText';
      const title = document.createElement('span');
      title.className = 'productName';
      title.textContent = product.name;
      const subtitle = document.createElement('span');
      subtitle.className = 'productBrand';
      subtitle.textContent = product.brand || product.id;
      content.append(title, subtitle);
      label.append(check, content);
      fragment.append(label);
    }
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'emptySearch';
      empty.textContent = '找不到符合的產品';
      fragment.append(empty);
    }
    picker.replaceChildren(fragment);
    picker.scrollTop = scroll;
  }

  function renderSelected() {
    const active = document.activeElement;
    const editId = active?.dataset?.description;
    const start = editId ? active.selectionStart : null;
    const end = editId ? active.selectionEnd : null;
    get('selectedCount').textContent = '已選 ' + ids.length + ' 項';
    for (const key of ['exportHTML', 'exportJPG', 'copyList', 'clearList']) {
      get(key).disabled = ids.length === 0;
    }
    if (!ids.length) {
      selectedItems.innerHTML = '<div class="previewempty">勾選上方產品，這裡會顯示推薦清單。</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const id of ids) {
      const product = byId.get(id);
      if (!product) continue;
      const article = document.createElement('article');
      article.className = 'item';
      const picture = document.createElement('div');
      picture.className = 'itemphoto';
      if (photoData.has(id)) {
        const image = document.createElement('img');
        image.alt = product.name;
        image.src = photoData.get(id);
        picture.append(image);
      } else {
        picture.textContent = approvedIds.has(id) ? '圖片讀取中' : '尚無圖片';
      }
      const info = document.createElement('div');
      info.className = 'iteminfo';
      const title = document.createElement('h4');
      title.className = 'itemname';
      title.textContent = product.name;
      const brand = document.createElement('p');
      brand.className = 'itembrand';
      brand.textContent = product.brand || '';
      const price = document.createElement('div');
      price.className = 'itemprice';
      price.textContent = priceOf(product);
      info.append(brand, title, price);
      const remove = document.createElement('button');
      remove.className = 'itemremove';
      remove.type = 'button';
      remove.dataset.remove = id;
      remove.textContent = '移除';
      remove.setAttribute('aria-label', '移除 ' + product.name);
      const top = document.createElement('div');
      top.className = 'itemtop';
      top.append(picture, info, remove);
      const edit = document.createElement('div');
      edit.className = 'descriptionwrap';
      const row = document.createElement('div');
      row.className = 'desclabelrow';
      const label = document.createElement('label');
      label.htmlFor = 'description-' + id;
      label.className = 'editlabel';
      label.textContent = '產品功能描述';
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'resetdesc';
      reset.dataset.resetDescription = id;
      reset.textContent = '還原預設';
      row.append(label, reset);
      const textarea = document.createElement('textarea');
      textarea.id = 'description-' + id;
      textarea.className = 'itemdesc';
      textarea.dataset.description = id;
      textarea.maxLength = 400;
      textarea.rows = 3;
      textarea.value = descriptionOf(product);
      edit.append(row, textarea);
      article.append(top, edit);
      fragment.append(article);
    }
    selectedItems.replaceChildren(fragment);
    if (editId && ids.includes(editId)) {
      const field = selectedItems.querySelector('textarea[data-description="' + editId + '"]');
      if (field) {
        field.focus({preventScroll: true});
        try { field.setSelectionRange(start, end); } catch {}
      }
    }
  }

  function update() {
    save();
    renderPicker();
    renderSelected();
  }

  function readAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('圖片讀取失敗'));
      reader.readAsDataURL(blob);
    });
  }

  async function cloudFetch(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('雲端圖片讀取失敗（HTTP ' + response.status + '）');
    return response;
  }

  async function loadPhoto(id) {
    if (!approvedIds.has(id) || !ids.includes(id)) return;
    if (photoData.has(id)) return;
    if (pendingPhotos.has(id)) return pendingPhotos.get(id);
    const task = (async () => {
      const response = await cloudFetch('/recommendation-list/api/images?id=' + encodeURIComponent(id));
      const photo = await readAsDataURL(await response.blob());
      if (approvedIds.has(id)) photoData.set(id, photo);
      renderSelected();
    })();
    pendingPhotos.set(id, task);
    try { await task; }
    finally { pendingPhotos.delete(id); }
  }

  async function refreshCloud(force = false) {
    try {
      const response = await cloudFetch('/recommendation-list/api/images');
      const manifest = await response.json();
      approvedIds = new Set((manifest.ids || []).filter(id => byId.has(id)));
      cloudConnected = true;
      cloudReady = true;
      if (force) photoData.clear();
      for (const id of [...photoData.keys()]) if (!approvedIds.has(id)) photoData.delete(id);
      get('cloudStatus').textContent = '已連接雲端圖片庫 · 已核准 ' + approvedIds.size + ' 張圖片。';
      renderSelected();
      const results = await Promise.allSettled(ids.filter(id => approvedIds.has(id)).map(loadPhoto));
      if (results.some(r => r.status === 'rejected')) {
        get('cloudStatus').textContent = '已連接雲端圖片庫，但部分圖片載入失敗；可稍後重試。';
      }
    } catch (error) {
      cloudReady = true;
      cloudConnected = false;
      get('cloudStatus').textContent = '雲端圖片暫時無法連線；仍可勾選並匯出文字推薦清單。';
    }
  }

  picker.addEventListener('change', event => {
    const target = event.target;
    if (target.tagName !== 'INPUT' || !byId.has(target.dataset.id)) return;
    const id = target.dataset.id;
    if (target.checked && !ids.includes(id)) ids.push(id);
    else if (!target.checked) ids = ids.filter(item => item !== id);
    update();
    if (target.checked && approvedIds.has(id)) loadPhoto(id).catch(() => toast('圖片暫時無法載入'));
  });

  selectedItems.addEventListener('input', event => {
    const field = event.target.closest('textarea[data-description]');
    if (!field || !byId.has(field.dataset.description)) return;
    const p = byId.get(field.dataset.description);
    if (field.value === preset(p)) delete edits[p.id];
    else edits[p.id] = field.value;
    persistEdits();
  });
  selectedItems.addEventListener('click', event => {
    const reset = event.target.closest('button[data-reset-description]');
    if (reset && byId.has(reset.dataset.resetDescription)) {
      const id = reset.dataset.resetDescription;
      delete edits[id];
      persistEdits();
      const field = selectedItems.querySelector('textarea[data-description="' + id + '"]');
      if (field) field.value = preset(byId.get(id));
      return;
    }
    const button = event.target.closest('button[data-remove]');
    if (!button) return;
    ids = ids.filter(id => id !== button.dataset.remove);
    update();
  });

  get('productSearch').addEventListener('input', renderPicker);
  get('clearList').addEventListener('click', () => {
    if (ids.length && confirm('確定清空所有已勾選產品？')) {
      ids = [];
      edits = Object.create(null);
      persistEdits();
      update();
    }
  });

  function namesText() {
    return '為您推薦的產品：\n\n' +
      ids.map((id, i) => {
        const product = byId.get(id);
        const description = descriptionOf(product);
        return (i + 1) + '. ' + product.name +
          '\n價格：' + priceOf(product) +
          (description ? '\n產品功能：' + description : '');
      }).join('\n\n') +
      '\n\n※ 本清單僅供選購參考，實際價格以官方網站為準。';
  }

  get('copyList').addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(namesText());
      else {
        const textarea = document.createElement('textarea');
        textarea.value = namesText();
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('無法複製');
      }
      toast('推薦清單已複製，可以貼到 LINE 或訊息');
    } catch { toast('複製失敗，請確認瀏覽器允許使用剪貼簿'); }
  });

  async function readyForExport() {
    if (!ids.length) { toast('請先勾選產品'); return false; }
    if (!cloudReady) await refreshCloud();
    const expected = ids.filter(id => approvedIds.has(id));
    await Promise.allSettled(expected.map(loadPhoto));
    const missing = expected.filter(id => !photoData.has(id));
    if (!cloudConnected) return confirm('雲端圖片庫無法連線。仍要輸出不含雲端圖片的推薦清單嗎？');
    if (missing.length) return confirm('有 ' + missing.length + ' 張已核准圖片尚未載入。要先輸出文字版推薦清單嗎？');
    return true;
  }

  function exportDocument() {
    const rows = ids.map(id => {
      const product = byId.get(id);
      const image = photoData.get(id);
      const photo = image
        ? '<img alt="' + esc(product.name) + '" src="' + image + '">'
        : '<span class="placeholder">圖片待補</span>';
      return '<article class="product">' +
        '<div class="product-top"><div class="pic">' + photo + '</div>' +
        '<div class="info"><p class="brand">' + esc(product.brand || '') + '</p>' +
        '<h2>' + esc(product.name) + '</h2><div class="price">' + esc(priceOf(product)) + '</div></div></div>' +
        '<p class="description">' + esc(descriptionOf(product)) + '</p></article>';
    }).join('');
    const css = '*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",Arial,sans-serif;' +
      'max-width:1100px;padding:20px;margin:20px auto;color:#243a40;background:white}' +
      'h1{font-size:26px;margin:0 0 22px}.products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}' +
      '.product{border:1px solid #e0e8e7;border-radius:12px;padding:16px;min-width:0;break-inside:avoid}' +
      '.product-top{display:flex;gap:13px;align-items:center}.pic{width:104px;height:104px;flex:0 0 104px;display:grid;place-items:center;' +
      'background:#f2f6f5;border-radius:9px;overflow:hidden}.pic img{width:100%;height:100%;object-fit:contain;background:white}' +
      '.placeholder{font-size:12px;color:#8b9da1}.info{min-width:0}.brand{color:#77888c;font-size:12px;margin:0}h2{font-size:17px;line-height:1.45;margin:6px 0}' +
      '.price{font-size:14px;font-weight:bold;color:#226b62}.description{white-space:pre-wrap;font-size:13px;line-height:1.65;color:#53676c;margin:13px 0 0}' +
      '.foot{font-size:11px;color:#87999b;margin:24px 0 0}' +
      '@media(max-width:750px){.products{grid-template-columns:1fr}.product{padding:14px}}' +
      '@media(max-width:450px){.pic{width:80px;height:80px;flex-basis:80px}h1{font-size:23px}h2{font-size:15px}}';
    const html = '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>專屬產品推薦清單</title><style>' + css + '</style></head><body>' +
      '<h1>為您推薦的產品</h1><div class="products">' + rows + '</div>' +
      '<p class="foot">本清單供產品介紹及選購參考，實際商品資訊與價格請以台灣官方網站為準。</p>' +
      '</body></html>';
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '專屬產品推薦清單-' + new Date().toLocaleDateString('sv-SE') + '.html';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('已下載推薦單 HTML');
  }

  let exportBusy = false;
  async function performExport(button, callback) {
    if (exportBusy) return;
    exportBusy = true;
    const before = button.textContent;
    button.disabled = true;
    button.textContent = '正在整理…';
    try {
      if (await readyForExport()) await callback();
    } catch (error) {
      toast('無法完成匯出：' + (error.message || '未知錯誤'));
    } finally {
      exportBusy = false;
      button.textContent = before;
      renderSelected();
    }
  }

  get('exportHTML').addEventListener('click', () => performExport(get('exportHTML'), exportDocument));
  get('exportJPG').addEventListener('click', () => performExport(get('exportJPG'), async () => {
    if (!window.RecommendationJpg?.exportList) throw new Error('JPG 匯出模組尚未載入');
    const items = ids.map(id => {
      const p = byId.get(id);
      return {
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        price: priceOf(p),
        description: descriptionOf(p),
        image: photoData.get(id) || null
      };
    });
    await window.RecommendationJpg.exportList(items);
    toast('單張 JPG 長圖已下載，可從手機下載項目開啟並儲存');
  }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCloud(true).catch(() => {});
  });

  update();
  refreshCloud().catch(() => {});
})();
