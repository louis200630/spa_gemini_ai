/* Reads the approved cloud image library into the original shopping-list tool.
   Keeps all original design, manual edits, ZIP import, HTML/PDF exports. */
'use strict';

const approvedCloudIds = new Set();
const cloudProductLoadedIds = new Set();
const cloudProductLoading = new Map();
let cloudCatalogReady = false;

const cloudCartNotice = document.createElement('div');
cloudCartNotice.className = 'tiny-note';
cloudCartNotice.style.marginTop = '9px';
cloudCartNotice.textContent = '雲端已核准圖片：連線中…；圖片 ZIP 仍可作為備份。';
get('imageLibraryStatus')?.parentElement?.insertAdjacentElement('afterend', cloudCartNotice);

async function cartCloudFetch(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let error = '無法讀取雲端圖片（HTTP ' + response.status + '）';
    try { error = (await response.json()).error || error; } catch {}
    throw new Error(error);
  }
  return response;
}

function cartDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('無法讀取雲端圖片檔案'));
    reader.readAsDataURL(blob);
  });
}

async function loadCartImage(id) {
  if (!approvedCloudIds.has(id)) return;
  if (cloudProductLoadedIds.has(id)) return;
  if (cloudProductLoading.has(id)) return cloudProductLoading.get(id);

  const task = (async () => {
    const response = await cartCloudFetch('/recommendation-list/api/images?id=' + encodeURIComponent(id));
    const data = await cartDataUrl(await response.blob());
    await saveImage(id, data);
    cloudProductLoadedIds.add(id);
    renderCart();
  })();

  cloudProductLoading.set(id, task);
  try { await task; } finally { cloudProductLoading.delete(id); }
}

function prefetchChosenCloudPhotos() {
  if (!cloudCatalogReady) return;
  for (const item of selected) {
    if (approvedCloudIds.has(item.id) && !cloudProductLoadedIds.has(item.id)) {
      loadCartImage(item.id).catch(error => showToast('圖片同步失敗：' + error.message));
    }
  }
}

const originalRenderCart = renderCart;
renderCart = function () {
  originalRenderCart();
  prefetchChosenCloudPhotos();
};

async function refreshCartCloud() {
  try {
    const response = await cartCloudFetch('/recommendation-list/api/images');
    const data = await response.json();
    const newIds = new Set((data.ids || []).filter(id => products.some(p => p.id === id)));
    const oldIds = new Set(approvedCloudIds);
    approvedCloudIds.clear();
    for (const id of newIds) approvedCloudIds.add(id);
    // Refetch the selected images on return to this tab: an image may have
    // been replaced and re-approved from the image-review page.
    for (const item of selected) cloudProductLoadedIds.delete(item.id);
    cloudCatalogReady = true;
    cloudCartNotice.textContent = '雲端圖片庫：已核准 ' + approvedCloudIds.size + ' 張；選入產品後會自動顯示圖片。ZIP 可作備份。';
    prefetchChosenCloudPhotos();
  } catch (error) {
    cloudCartNotice.textContent = '雲端圖片庫無法連線：' + error.message + '（本機及 ZIP 功能仍可使用）';
  }
}

async function ensureExportPhotos() {
  if (!cloudCatalogReady) return;
  const photos = selected.filter(item => approvedCloudIds.has(item.id));
  await Promise.all(photos.map(item => loadCartImage(item.id)));
}

function waitForImagesBefore(button, action) {
  button.addEventListener('click', async event => {
    const needed = !cloudCatalogReady || selected.some(item => approvedCloudIds.has(item.id) && !cloudProductLoadedIds.has(item.id));
    if (!needed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    cloudCartNotice.textContent = '正在補齊清單圖片後匯出…';
    try {
      if (!cloudCatalogReady) await refreshCartCloud();
      await ensureExportPhotos();
      action();
      cloudCartNotice.textContent = '圖片已載入，可正常匯出含圖版本。';
    } catch (error) {
      alert('無法取得全部雲端圖片，匯出已暫停：' + error.message);
    } finally {
      button.disabled = false;
    }
  }, true);
}

waitForImagesBefore(get('exportCustomerButton'), exportCustomerHtml);
waitForImagesBefore(get('printButton'), () => window.print());

// Refresh when returning from the review page in another tab.
window.addEventListener('focus', () => {
  if (!cloudCatalogReady || document.visibilityState !== 'visible') return;
  refreshCartCloud();
});

// Let the original local IndexedDB hydration finish before loading remote data.
// The private cloud is authoritative for already approved product images.
hydrateImages().then(refreshCartCloud).catch(refreshCartCloud);
