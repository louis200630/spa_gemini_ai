# 健康問卷與產品推薦工具

正式網址：

- 健康問卷（維持原版）：https://spa-gemini-ai.vercel.app/
- 圖片核對中心（保留原功能）：https://spa-gemini-ai.vercel.app/image-review/
- 快速產品推薦清單（簡化版）：https://spa-gemini-ai.vercel.app/recommendation-list/

兩個內部工具頁受 Vercel Basic Auth 驗證；健康問卷保持公開。兩者均使用固定網址，GitHub `main` 更新後由 Vercel 自動部署。

## 快速產品推薦清單

新頁面聚焦四件事：

1. 左側搜尋品名、品牌或產品 P 編號。
2. 勾選產品；右側即時顯示圖片、品牌及產品名稱。
3. 從 Vercel Private Blob 自動載入「圖片核對中心」已核准的圖片，不需每次匯入 ZIP。
4. 選擇「下載推薦單」（含圖、離線可開啟 HTML）、「複製文字」（可貼 LINE）或「列印／PDF」。

不提供品項數量、價格計算、產品文案修改、CSV 匯入及 ZIP 圖片匯入等設定，以維持操作簡單。已勾選的產品 ID 僅暫存在目前瀏覽器 localStorage；可按「清空」重置。

**注意：** 這個簡化工具不依照健康問卷自動挑選商品，它是供內部人員勾選產品後產生客戶推薦清單。推薦給客戶的 HTML 會嵌入成功載入的產品圖片。未核准或無法讀取的圖片會顯示為「尚無圖片」。

## 檔案對應

- `spa_gemini_ai.html`：原始健康問卷，完整保留。
- `tools/圖片核對中心.html`：原始圖片核對及批次 ZIP 工具，完整保留。
- `cloud-sync-review.js`：人工核准後傳送照片到私有雲端並撤回圖片。
- `tools/產品選購清單.html`：**先前完整功能版備份及產品資料來源**，不再發布在快速推薦清單網址。
- `tools/簡易產品推薦清單.html`：現在發布的新頁面，提供搜尋、勾選與預覽。
- `simple-recommendations.js`：勾選、跨頁圖片載入、複製文字、下載 HTML、列印／PDF 的程式。
- `build-site.mjs`：讀取原始清單 HTML 的 `BASE_PRODUCTS`（目前 133 項），自動生成 `recommendation-list/catalog.js`，避免再手動維護第二套產品名稱。
- `api/product-images.js`：後端私有 Blob 圖片 API，驗證後才允許讀取、儲存或移除圖片。
- `middleware.js`、`vercel.json`：保護工具頁以及 API 路由。

## 圖片操作與備份

平時請到圖片核對中心：選產品 → 貼上圖片 → 勾選核對 → 核准。
雲端核准成功後，即可回到快速產品推薦清單勾選對應商品，圖片會自動出現。

舊版的本機已核准圖片可以先「還原既有圖片 ZIP」，再按「首次同步舊圖片」一次搬移。原始 ZIP 匯入／匯出仍在圖片核對中心，作為備份用途。

所有圖片目前儲存在 Vercel 私有 Blob，並按 `product-images/approved/P001.jpg` 等 ID 命名。圖片管理金鑰存在 Vercel 環境變數，不會傳給前端。

## 限制及驗收

- 原始完整型錄中的產品名稱與其他資料未做外部官網更新核對。
- 新版畫面與功能已經過程式語法、建置及部署狀態檢查，但還須登入瀏覽器實際確認圖片出現、HTML 下載與手機響應式顯示。
- 目前 Vercel GitHub 儲存庫的公開性不因 Basic Auth 而改變；只有工具頁和雲端圖片 API 使用密碼保護。
- 如作商業用途，請確保 Vercel 服務方案符合其商用條款。

