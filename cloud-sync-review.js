/* Adds cloud sync without changing the original offline image-review tool. */
'use strict';

const cloudApiUrl = '/image-review/api/images';
const cloudApprovedIds = new Set();
const cloudEditedIds = new Set();
const cloudLoadedIds = new Set();
const cloudLoadingIds = new Map();
let cloudReady = false;

const cloudStatusLine = document.createElement('p');
cloudStatusLine.className = 'muted';
cloudStatusLine.style.margin = '8px 0 0';
cloudStatusLine.textContent = '雲端圖片庫：連線中…';
document.querySelector('.top .buttons')?.append(cloudStatusLine);

function cloudMessage(message) {
  cloudStatusLine.textContent = message;
}

async function cloudRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options
  });
  if (!response.ok) {
    let error = '雲端同步失敗（HTTP ' + response.status + '）';
    try { error = (await response.json()).error || error; } catch {}
    throw new Error(error);
  }
  return response;
}

async function cloudDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('無法讀取雲端圖片'));
    reader.readAsDataURL(blob);
  });
}

const localState = state;
state = function (id) {
  if (cloudEditedIds.has(id)) return images[id] ? 'draft' : 'pending';
  if (cloudApprovedIds.has(id)) return 'approved';
  return localState(id);
};

const originalAddFileTo = addFileTo;
addFileTo = async function (id, file) {
  cloudEditedIds.add(id);
  try {
    return await originalAddFileTo(id, file);
  } catch (error) {
    cloudEditedIds.delete(id);
    throw error;
  }
};

async function cloudLoadImage(id) {
  if (!cloudApprovedIds.has(id) || cloudEditedIds.has(id)) return;
  if (cloudLoadedIds.has(id)) return;
  if (cloudLoadingIds.has(id)) return cloudLoadingIds.get(id);

  const task = (async () => {
    const response = await cloudRequest(cloudApiUrl + '?id=' + encodeURIComponent(id));
    const data = await cloudDataUrl(await response.blob());
    if (cloudEditedIds.has(id)) return;
    images[id] = data;
    ensureMeta(id).approved = true;
    cloudLoadedIds.add(id);
    await persistPhoto(id, data);
    if (id === selected) render();
  })();
  cloudLoadingIds.set(id, task);
  try { await task; } finally { cloudLoadingIds.delete(id); }
}

async function cloudRefresh() {
  try {
    const response = await cloudRequest(cloudApiUrl);
    const payload = await response.json();
    const before = new Set(cloudApprovedIds);
    cloudApprovedIds.clear();
    for (const id of payload.ids || []) if (byId[id]) cloudApprovedIds.add(id);
    for (const id of cloudLoadedIds) if (!cloudApprovedIds.has(id)) cloudLoadedIds.delete(id);
    // A changed image on another device should be re-fetched when selected.
    if (cloudApprovedIds.has(selected) && !cloudEditedIds.has(selected)) {
      cloudLoadedIds.delete(selected);
    }
    // Preserve local unapproved replacement drafts after page reload.
    for (const p of PRODUCTS) {
      if (cloudApprovedIds.has(p.id) && images[p.id] && meta[p.id]?.approved === false) {
        cloudEditedIds.add(p.id);
      }
    }
    cloudReady = true;
    cloudMessage('雲端圖片庫：' + cloudApprovedIds.size + ' 張已核准並同步');
    render();
    if (cloudApprovedIds.has(selected)) {
      await cloudLoadImage(selected);
    }
  } catch (error) {
    cloudMessage('雲端連線失敗：' + error.message + '；請保留 ZIP 備份');
    msg('雲端圖片庫暫時無法讀取：' + error.message);
  }
}

const originalSelectProduct = selectProduct;
selectProduct = function (id) {
  originalSelectProduct(id);
  if (cloudApprovedIds.has(id) && !cloudEditedIds.has(id)) {
    cloudLoadImage(id).catch(error => msg(error.message));
  }
};

function cloudMetadata(id) {
  const p = byId[id];
  const m = meta[id] || {};
  return {
    id,
    image: images[id],
    code: m.code || p?.code || '',
    url: m.url || p?.url || '',
    note: m.note || '',
    filename: m.filename || ''
  };
}

async function cloudApproveOne(id) {
  const data = images[id];
  if (!data || !data.startsWith('data:image/jpeg;base64,')) {
    throw new Error(id + ' 沒有可用的 JPG 圖片，請重新選圖。');
  }
  const response = await cloudRequest(cloudApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cloudMetadata(id))
  });
  await response.json();
  cloudApprovedIds.add(id);
  cloudEditedIds.delete(id);
  cloudLoadedIds.add(id);
  cloudMessage('雲端圖片庫：' + cloudApprovedIds.size + ' 張已核准並同步');
}

async function cloudDeleteOne(id) {
  await cloudRequest(cloudApiUrl, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  cloudApprovedIds.delete(id);
  cloudLoadedIds.delete(id);
  cloudEditedIds.delete(id);
  cloudMessage('雲端圖片庫：' + cloudApprovedIds.size + ' 張已核准並同步');
}

const localApprove = $('approveBtn').onclick;
$('approveBtn').onclick = async function () {
  const id = selected;
  if (!images[id] || !$('reviewCheck').checked) return;
  $('approveBtn').disabled = true;
  cloudMessage('正在上傳並核准 ' + id + '…');
  try {
    await cloudApproveOne(id);
    if (selected === id) {
      localApprove();
      msg(id + ' 已核准，圖片已自動同步至雲端');
    } else {
      ensureMeta(id).approved = true;
      storeMeta();
      render();
    }
  } catch (error) {
    $('approveBtn').disabled = false;
    cloudMessage('雲端同步失敗；圖片仍在本機，請重試核准');
    alert(error.message);
  }
};

const localUnapprove = $('unapproveBtn').onclick;
$('unapproveBtn').onclick = async function () {
  const id = selected;
  try {
    await cloudDeleteOne(id);
    if (id === selected) localUnapprove();
    else {
      ensureMeta(id).approved = false;
      storeMeta();
      render();
    }
    msg(id + ' 雲端核准已撤回');
  } catch (error) {
    alert('無法撤回雲端圖片：' + error.message);
  }
};

$('discardBtn').onclick = async function () {
  const id = selected;
  if (!images[id] && !cloudApprovedIds.has(id)) return;
  if (!confirm('確定移除 ' + id + ' 的圖片？此操作也會移除雲端已核准圖片。')) return;
  try {
    if (cloudApprovedIds.has(id)) await cloudDeleteOne(id);
    await deletePhoto(id);
    cloudEditedIds.delete(id);
    msg('圖片已從本機及雲端移除');
  } catch (error) {
    alert('移除失敗：' + error.message);
  }
};

// Restore ZIP stays available for one-time migration and backup.
const localRestorePack = restorePack;
restorePack = async function (file) {
  await localRestorePack(file);
  for (const p of PRODUCTS) {
    if (meta[p.id]?.approved && images[p.id]) cloudEditedIds.delete(p.id);
  }
  render();
  msg('舊 ZIP 已還原；可使用「同步舊圖片」將核准照片一次搬到雲端。');
};

const backupExport = exportPack;
$('exportBtn').onclick = async function () {
  const needed = PRODUCTS.filter(p => cloudApprovedIds.has(p.id) && !cloudLoadedIds.has(p.id));
  try {
    for (const p of needed) await cloudLoadImage(p.id);
    await backupExport();
  } catch (error) {
    alert('無法完成 ZIP 備份：' + error.message);
  }
};

const syncOldButton = document.createElement('button');
syncOldButton.className = 'btn';
syncOldButton.type = 'button';
syncOldButton.textContent = '首次同步舊圖片';
$('batchBtn').before(syncOldButton);
syncOldButton.onclick = async function () {
  const pending = PRODUCTS.filter(p =>
    images[p.id] && meta[p.id]?.approved && !cloudApprovedIds.has(p.id)
  );
  if (!pending.length) return msg('沒有需要轉移的已核准本機圖片');
  if (!confirm('將 ' + pending.length + ' 張本機已核准圖片上傳至雲端？')) return;
  syncOldButton.disabled = true;
  let saved = 0;
  const failed = [];
  try {
    for (const p of pending) {
      cloudMessage('首次同步圖片：' + (saved + failed.length + 1) + '/' + pending.length);
      try { await cloudApproveOne(p.id); saved++; }
      catch (error) { failed.push(p.id); }
    }
    render();
    alert('成功同步 ' + saved + ' 張；失敗 ' + failed.length + ' 張' +
      (failed.length ? '：' + failed.slice(0,10).join('、') : '') + '。');
  } finally {
    syncOldButton.disabled = false;
    cloudMessage('雲端圖片庫：' + cloudApprovedIds.size + ' 張已核准並同步');
  }
};

window.addEventListener('focus', () => {
  if (cloudReady && document.visibilityState === 'visible') {
    cloudRefresh().catch(() => {});
  }
});

hydrate().then(cloudRefresh).catch(cloudRefresh);
