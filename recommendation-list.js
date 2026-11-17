(function () {
  'use strict';

  const products = window.RECOMMENDATION_CATALOG || {};
  const selected = new Map();
  let coverUrl = '';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);
  const priceValue = value => {
    const match = String(value || '').match(/NT\$\s*([\d,]+)/i);
    return match ? Number(match[1].replaceAll(',','')) : null;
  };
  const money = num => 'NT$' + num.toLocaleString('zh-TW');
  const toast = message => {
    $('toast').textContent = message;
    $('toast').style.display = 'block';
    clearTimeout(window.__toastDelay);
    window.__toastDelay = setTimeout(() => $('toast').style.display = 'none', 2500);
  };

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('請選擇圖片檔案'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('圖片請小於 10 MB'));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('無法讀取圖片'));
      reader.readAsDataURL(file);
    });
  }

  function updateSearch() {
    const term = $('product-search').value.trim().toLocaleLowerCase();
    const matches = Object.entries(products).filter(([id,p]) => {
      if (!term) return false;
      return (String(p.name || '') + ' ' + String(p.brand || '')).toLocaleLowerCase().includes(term);
    }).slice(0,30);
    $('search-results').innerHTML = term ? (matches.length ? matches.map(([id,p]) =>
      '<button type="button" data-add="' + escape(id) + '">' +
      escape(p.name) + '<span>' + escape(p.brand || '') + ' · ' + escape(p.price || '價格待確認') + '</span></button>'
    ).join('') : '<div class="empty">找不到相符產品</div>') : '<div class="empty">開始輸入產品名稱即可搜尋。</div>';
  }

  function updateEditors() {
    $('selected-editors').innerHTML = Array.from(selected, ([id,item]) => {
      const p = products[id];
      return '<div class="item-editor" data-id="' + escape(id) + '"><h3>' + escape(p.name) + '</h3>' +
        '<div class="item-tools"><label class="small">數量 <input aria-label="產品數量" data-qty="' + escape(id) + '" type="number" min="1" max="99" step="1" value="' + item.qty + '"></label>' +
        '<button type="button" class="danger" data-remove="' + escape(id) + '">移除</button></div>' +
        '<div class="field"><label>替換產品圖片（選填）</label><input type="file" accept="image/*" data-photo="' + escape(id) + '"></div>' +
        '<div class="field"><label>產品備註（選填）</label><textarea class="note" rows="2" data-note="' + escape(id) + '" placeholder="建議搭配或使用提醒">' + escape(item.note) + '</textarea></div>' +
        '</div>';
    }).join('') || '<p class="small">尚未加入產品。</p>';
  }

  function renderPreview() {
    $('print-title').textContent = $('sheet-title').value.trim() || '產品推薦清單';
    $('print-message').textContent = $('sheet-message').value.trim();
    $('print-cover').hidden = !coverUrl;
    if (coverUrl) $('print-cover').src = coverUrl;
    else $('print-cover').removeAttribute('src');

    let total = 0;
    let unknown = 0;
    $('print-items').innerHTML = Array.from(selected, ([id,item]) => {
      const p = products[id];
      const price = priceValue(p.price);
      if (price === null) unknown++;
      else total += price * item.qty;
      const picture = item.photo
        ? '<img src="' + item.photo + '" alt="' + escape(p.name) + '">'
        : '<div class="placeholder" aria-hidden="true">◇</div>';
      return '<section class="paper-item">' + picture +
        '<div style="min-width:0;flex:1"><h3>' + escape(p.name) + '</h3>' +
        '<div class="small">' + escape(p.brand || '') + ' · 數量 ' + item.qty + '</div>' +
        '<div class="desc">' + escape(item.note || p.desc || '') + '</div></div>' +
        '<div class="price">' + (price === null ? escape(p.price || '價格待確認') : money(price * item.qty)) + '</div></section>';
    }).join('') || '<p class="small">尚未加入任何產品，請從左側搜尋並新增。</p>';

    $('print-total').textContent = selected.size ? '參考合計 ' + money(total) + (unknown ? '（部分價格待確認）' : '') : '';
  }

  function render() {
    updateEditors();
    renderPreview();
  }

  $('sheet-title').addEventListener('input', renderPreview);
  $('sheet-message').addEventListener('input', renderPreview);
  $('product-search').addEventListener('input', updateSearch);

  $('search-results').addEventListener('click', event => {
    const button = event.target.closest('button[data-add]');
    if (!button || !Object.prototype.hasOwnProperty.call(products, button.dataset.add)) return;
    const id = button.dataset.add;
    if (!selected.has(id)) selected.set(id, {qty:1,note:'',photo:''});
    else selected.get(id).qty += 1;
    render();
    toast('已加入清單');
  });

  $('selected-editors').addEventListener('click', event => {
    const btn = event.target.closest('button[data-remove]');
    if (!btn) return;
    selected.delete(btn.dataset.remove);
    render();
  });

  $('selected-editors').addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.qty && selected.has(el.dataset.qty)) {
      const qty = Number(el.value);
      if (Number.isFinite(qty) && qty >= 1) {
        selected.get(el.dataset.qty).qty = Math.min(99,Math.floor(qty));
        renderPreview();
      }
    }
    if (el.dataset.note && selected.has(el.dataset.note)) {
      selected.get(el.dataset.note).note = el.value;
      renderPreview();
    }
  });

  $('selected-editors').addEventListener('change', async event => {
    const el = event.target;
    if (el.dataset.qty && selected.has(el.dataset.qty)) {
      el.value = String(selected.get(el.dataset.qty).qty);
    }
    if (el.dataset.photo && selected.has(el.dataset.photo)) {
      try {
        const url = await fileToDataURL(el.files[0]);
        selected.get(el.dataset.photo).photo = url;
        renderPreview();
      } catch (err) { toast(err.message); }
    }
  });

  $('sheet-cover').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) { coverUrl='';renderPreview();return; }
    try {
      coverUrl = await fileToDataURL(file);
      renderPreview();
    } catch (err) {toast(err.message);}
  });

  $('btn-reset').addEventListener('click', () => {
    if (!selected.size && !coverUrl) return;
    if (!window.confirm('確定清空目前產品與圖片？')) return;
    selected.clear(); coverUrl = '';
    $('sheet-cover').value = ''; $('product-search').value = '';
    render(); updateSearch();
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href=url;link.download=filename;
    document.body.appendChild(link);
    link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const today = () => new Date().toLocaleDateString('sv-SE');

  $('btn-csv').addEventListener('click', () => {
    if (!selected.size) return toast('請先選擇產品');
    const rows = [['產品名稱','品牌','數量','單價','小計','備註'], ...Array.from(selected, ([id,item]) => {
      const p=products[id],n=priceValue(p.price);
      return [p.name,p.brand||'',item.qty,p.price||'',n===null?'':money(n*item.qty),item.note||''];
    })];
    const csv = '\uFEFF'+rows.map(row => row.map(value => {
      let str=String(value??'');
      if (/^[\s]*[=+\-@]/.test(str))str="'"+str;
      return '"' + str.replaceAll('"','""') + '"';
    }).join(',')).join('\r\n');
    downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'產品推薦清單-'+today()+'.csv');
  });

  $('btn-print').addEventListener('click', () => {
    if (!selected.size) return toast('請先選擇產品');
    window.print();
  });

  $('btn-png').addEventListener('click', async () => {
    if (!selected.size) return toast('請先選擇產品');
    if (typeof window.html2canvas !== 'function') return toast('圖片匯出元件尚未載入，請先使用列印 PDF');
    const button = $('btn-png');
    button.disabled=true;button.textContent='正在產生圖片…';
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await window.html2canvas($('print-area'), {
        backgroundColor:'#ffffff',
        scale:Math.min(2,window.devicePixelRatio||2),
        useCORS:true,
        logging:false,
        windowWidth:1100
      });
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if (!blob)throw new Error('無法建立 PNG');
      downloadBlob(blob,'產品推薦清單-'+today()+'.png');
      toast('推薦清單圖片已下載');
    } catch(e) {
      toast(e?.message || '無法匯出圖片');
    } finally {
      button.disabled=false;button.textContent='下載圖片 PNG';
    }
  });

  updateSearch();
  render();
})();
