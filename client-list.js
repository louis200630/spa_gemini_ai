/* Optional client list editor and exports. Does not modify the questionnaire scoring matrices. */
(function () {
  'use strict';

  if (typeof PRODUCT_DB === 'undefined') return;
  const recommendations = document.getElementById('products-list');
  if (!recommendations) return;

  // Confirmed manual-only product: never added to MATRIX_DB or nutrient recommendations.
  if (!PRODUCT_DB.p135) {
    PRODUCT_DB.p135 = {
      name: '樂優選™胜肽益生亮白牙膏',
      brand: '樂優選™ The Usuals',
      price: 'NT$340',
      tags: ['個人衛生'],
      manualOnly: true,
      desc: '[日常口腔潔淨與亮白保養] 清新薄荷牙膏，結合羥基磷灰石、胜肽及發酵來源成分，幫助清潔牙齒、去除表面牙漬，使牙齒維持自然潔淨光澤，並帶來清新口氣。適合重視牙齒日常清潔、自然亮白及口腔保養的人士。'
    };
  }

  const chosen = new Set();
  const editor = document.createElement('section');
  editor.id = 'client-list-editor';
  editor.className = 'glass-panel p-6 rounded-[2rem] border border-slate-200';
  editor.innerHTML = [
    '<h3 class="font-bold text-slate-800 text-lg mb-2">📋 客戶產品清單</h3>',
    '<p class="text-sm text-slate-600 mb-4">從上方的推薦產品按「加入清單」，也能在下方搜尋任何產品自行加入。這不會改變健康問卷的推薦分數。</p>',
    '<label for="client-product-search" class="font-semibold text-slate-700 text-sm">搜尋產品</label>',
    '<input id="client-product-search" type="search" autocomplete="off" placeholder="輸入品牌或產品名稱，例如：牙膏" class="block w-full mt-2 mb-3 px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-800" />',
    '<div id="client-search-results" class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"></div>',
    '<h4 class="font-bold text-slate-800 mt-4 mb-2">已選擇的產品</h4>',
    '<div id="client-selected-products" class="space-y-2"></div>',
    '<p id="client-list-total" class="font-bold text-slate-800 text-right mt-4"></p>',
    '<div class="flex flex-wrap gap-3 mt-4">',
    '<button id="client-download-csv" type="button" class="px-5 py-3 rounded-xl bg-slate-800 text-white font-bold">⬇ 匯出 CSV 清單</button>',
    '<button id="client-print" type="button" class="px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold">🖨 列印／另存 PDF</button>',
    '</div>',
    '<p class="text-xs text-slate-500 mt-3">不會上傳或儲存客戶選取紀錄；下載的檔案只留在您的裝置。價格以實際官網結帳為準。</p>'
  ].join('');

  const recommendationGrid = recommendations.closest('.grid');
  if (recommendationGrid) recommendationGrid.insertAdjacentElement('afterend', editor);
  else document.getElementById('stage-4').appendChild(editor);

  const searchField = document.getElementById('client-product-search');
  const searchResults = document.getElementById('client-search-results');
  const selectedPanel = document.getElementById('client-selected-products');
  const totalPanel = document.getElementById('client-list-total');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function moneyNumber(price) {
    const match = String(price || '').match(/NT\$\s*([\d,]+)/i);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }

  function selectedEntries() {
    return Array.from(chosen).filter(function (id) {
      return !!PRODUCT_DB[id];
    }).map(function (id) {
      return { id: id, product: PRODUCT_DB[id] };
    });
  }

  function alertMessage(message) {
    if (typeof showToast === 'function') showToast(message);
    else window.alert(message);
  }

  function renderChosen() {
    const items = selectedEntries();
    if (!items.length) {
      selectedPanel.innerHTML = '<p class="text-sm text-slate-500 bg-white/60 p-4 rounded-xl">尚未加入產品。可從推薦清單選擇，或直接搜尋並加入。</p>';
      totalPanel.textContent = '已選 0 項';
      return;
    }
    selectedPanel.innerHTML = items.map(function (entry) {
      return '<div class="flex items-start gap-3 justify-between bg-white/80 border border-slate-200 rounded-xl p-3">' +
        '<div class="min-w-0"><div class="font-bold text-slate-800 text-sm">' + escapeHtml(entry.product.name) + '</div>' +
        '<div class="text-sm text-slate-500">' + escapeHtml(entry.product.brand) + ' · ' + escapeHtml(entry.product.price) + '</div></div>' +
        '<button type="button" data-client-remove="' + escapeHtml(entry.id) + '" class="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold">移除</button></div>';
    }).join('');

    let sum = 0;
    let hasUnknown = false;
    items.forEach(function (entry) {
      const price = moneyNumber(entry.product.price);
      if (price === null) hasUnknown = true;
      else sum += price;
    });
    totalPanel.textContent = '已選 ' + items.length + ' 項 · 參考合計 NT$' + sum.toLocaleString('zh-TW') + (hasUnknown ? '（部分品項價格待確認）' : '');
  }

  function addProduct(id) {
    if (!Object.prototype.hasOwnProperty.call(PRODUCT_DB, id)) return;
    chosen.add(id);
    renderChosen();
    alertMessage('已加入客戶產品清單');
  }

  function renderSearch() {
    const keyword = searchField.value.trim().toLocaleLowerCase();
    if (!keyword) {
      searchResults.innerHTML = '';
      return;
    }
    const matches = Object.entries(PRODUCT_DB).filter(function (entry) {
      const product = entry[1];
      return (String(product.name || '') + ' ' + String(product.brand || '')).toLocaleLowerCase().includes(keyword);
    }).slice(0, 12);

    searchResults.innerHTML = matches.length ? matches.map(function (entry) {
      return '<button type="button" data-client-add="' + escapeHtml(entry[0]) + '" class="text-left bg-white/80 border border-slate-200 hover:border-slate-400 rounded-xl p-3">' +
        '<span class="block font-semibold text-slate-800 text-sm">' + escapeHtml(entry[1].name) + '</span>' +
        '<span class="block text-xs text-slate-500 mt-1">' + escapeHtml(entry[1].price) + ' · ＋加入清單</span></button>';
    }).join('') : '<p class="text-sm text-slate-500">找不到相符產品。</p>';
  }

  function decorateRecommendations() {
    const products = window.currentRecProducts || [];
    if (recommendations.children.length !== products.length) return;
    Array.from(recommendations.children).forEach(function (card, index) {
      const p = products[index];
      if (!p || card.querySelector('[data-client-add]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.clientAdd = p.id;
      button.textContent = '＋ 加入客戶清單';
      button.className = 'block mt-3 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200';
      (card.querySelector('.flex-grow') || card).appendChild(button);
    });
  }

  recommendations.addEventListener('click', function (event) {
    const button = event.target.closest('[data-client-add]');
    if (button) addProduct(button.dataset.clientAdd);
  });
  searchResults.addEventListener('click', function (event) {
    const button = event.target.closest('[data-client-add]');
    if (button) addProduct(button.dataset.clientAdd);
  });
  selectedPanel.addEventListener('click', function (event) {
    const button = event.target.closest('[data-client-remove]');
    if (button) {
      chosen.delete(button.dataset.clientRemove);
      renderChosen();
    }
  });
  searchField.addEventListener('input', renderSearch);
  new MutationObserver(decorateRecommendations).observe(recommendations, { childList: true });
  decorateRecommendations();

  function csvValue(value) {
    let s = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  document.getElementById('client-download-csv').addEventListener('click', function () {
    const items = selectedEntries();
    if (!items.length) {
      alertMessage('請先加入產品');
      return;
    }
    const rows = [['產品名稱', '品牌', '售價', '產品說明']].concat(items.map(function (entry) {
      const p = entry.product;
      return [p.name, p.brand, p.price, p.desc];
    }));
    const csv = '\uFEFF' + rows.map(function (row) {
      return row.map(csvValue).join(',');
    }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '客戶產品清單-' + new Date().toLocaleDateString('sv-SE') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  document.getElementById('client-print').addEventListener('click', function () {
    const items = selectedEntries();
    if (!items.length) {
      alertMessage('請先加入產品');
      return;
    }
    const rows = items.map(function (entry, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(entry.product.name) + '</td><td>' +
        escapeHtml(entry.product.brand) + '</td><td>' + escapeHtml(entry.product.price) + '</td></tr>';
    }).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alertMessage('請允許瀏覽器開啟列印視窗');
      return;
    }
    const sum = items.reduce(function (acc, entry) {
      return acc + (moneyNumber(entry.product.price) || 0);
    }, 0);
    printWindow.document.write('<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>客戶產品清單</title>' +
      '<style>body{font-family:Arial,"Noto Sans TC",sans-serif;padding:28px;color:#1e293b}h1{font-size:22px}' +
      'table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px;text-align:left;border-bottom:1px solid #cbd5e1}' +
      'th{background:#f1f5f9}p{font-size:12px;color:#64748b}</style></head><body>' +
      '<h1>客戶產品清單</h1><table><thead><tr><th>#</th><th>品名</th><th>品牌</th><th>售價</th></tr></thead><tbody>' +
      rows + '</tbody></table><strong>參考合計：NT$' + sum.toLocaleString('zh-TW') + '</strong>' +
      '<p>價格以官網實際結帳為準。本清單僅供產品介紹與參考，不作為診斷或治療依據。</p>' +
      '<script>window.onload=function(){window.print();};<\/script></body></html>');
    printWindow.document.close();
  });

  document.querySelectorAll('.btn-restart').forEach(function (button) {
    button.addEventListener('click', function () {
      chosen.clear();
      searchField.value = '';
      searchResults.innerHTML = '';
      renderChosen();
    });
  });

  renderChosen();
})();
