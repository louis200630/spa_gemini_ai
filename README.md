# 台灣美安健康問卷與個人產品工具

正式網站：https://spa-gemini-ai.vercel.app/

## 三個獨立頁面

1. **健康問卷**：`/`。使用 `spa_gemini_ai.html` 原樣建置，問卷題目、營養素、評分與自動推薦矩陣不因這次圖片雲端化而更動。
2. **產品圖片核對中心**：`/image-review/`。原始上傳版 HTML：`tools/圖片核對中心.html`。選品、貼上官網圖片、核對，按「核准此圖」會**自動同步到私有雲端圖片庫**；撤回核准會從雲端移除。
3. **專屬產品選購清單**：`/recommendation-list/`。原始上傳版 HTML：`tools/產品選購清單.html`。原有選品、貼上名單、修改清單、匯出顧客版 HTML、列印 PDF 等功能維持，並新增自動讀取已核准雲端圖片。

兩個工具頁都受 `middleware.js` 的 Basic Authentication 保護（環境變數 `PRIVATE_TOOLS_PASSWORD`），不會將金鑰寫到網頁。工具頁讀寫圖片時使用 `/image-review/api/images` 或 `/recommendation-list/api/images`，由 `vercel.json` 改寫到 `api/product-images.js`；**API 自身也會再做 Basic Auth 驗證**。健康問卷保持公開。

## 雲端架構

- Vercel Blob **Private** 圖片儲存空間 `spa-product-images-private`（香港區域 hkg1）。
- `BLOB_READ_WRITE_TOKEN` 只存在 Vercel 伺服器端，並且只供 `api/product-images.js` 使用，沒有提供給前端。
- 存放路徑 `product-images/approved/P001.jpg`、`product-images/records/P001.json`；同一產品 P ID 對應同一張核准主圖。可重複核准以更新圖片。
- GET 列出核准 IDs / 依 ID 取 JPEG；POST 核准上傳；DELETE 撤回圖片。所有 API 均需登入、禁用回應快取。
- 所有圖片儲存在雲端**而非 GitHub 部署檔案**，因此更換網站版本不會清空圖片庫。
- 原始 `tools/*.html` 保留，`build-site.mjs` 在部署時額外插入 `cloud-sync-review.js`、`cloud-sync-cart.js`，不會更改健康問卷 HTML。

## 操作流程

**平時：** 在圖片核對中心選擇商品 → 從官網複製圖片 → Ctrl+V 貼上 → 勾選已核對 → 按「核准此圖」 → 顯示「已自動同步至雲端」。接著在產品選購清單中選取該商品，就會自動載入雲端圖片。日常流程**不必再下載 ZIP／重新匯入 ZIP**。

**舊照片首次遷移：** 若照片先前儲存在舊版 HTML 或舊瀏覽器，請先在圖片核對中心「還原既有圖片 ZIP」，再按「首次同步舊圖片」一次批次上傳。不同網站來源的本機 IndexedDB 無法直接自動共享。

**保留備份：** 仍可在圖片核對中心匯出已核准圖片 ZIP；產品選購清單也保留 ZIP 匯入、匯出顧客 HTML 與列印 PDF。

**跨裝置：** 不同電腦或手機用相同工具頁登入後，都可讀取已核准的雲端圖片。需要同頁即時更新時，切換分頁回來或重新整理即可。

## 維護與安全

- 頁面原始資料目前為 133 項商品；新產品如有增加，應同步維護兩個原始工具的產品 ID，避免圖片配錯。
- 商品資料、價格、產品描述及健康問卷矩陣並未移到 Blob；**本次只雲端化核准圖片與圖片核對資訊**，不是完整的商品資料 SQL 資料庫。
- 雲端圖片**不會自動變成健康問卷的推薦結果圖片**；只在兩個後台工具間自動同步。
- 私有圖片不透過公開 Blob URL 提供，僅由通過帳號密碼認證的 Vercel API 讀取。
- GitHub 儲存庫本身若是公開的，原始程式碼仍可能被瀏覽；程式碼內不包含 Blob token 或個人密碼。
- 瀏覽器操作與實際上傳需從登入後工具頁測試；部署 READY 僅代表建置成功，不代表所有瀏覽器操作均已完成驗收。
- 已儲存的圖片會使用 Vercel Blob 配額。Vercel Hobby 只允許非商業使用；若用於客戶銷售或商業業務，應使用符合條款的方案。
