# 美安台灣健康問卷與個人產品工具

正式固定網站：https://spa-gemini-ai.vercel.app/

## 頁面與公開範圍

- 健康問卷（公開）：`/`，原始檔為 `spa_gemini_ai.html`，完全原樣輸出，不修改題目、營養素、推薦矩陣或產品列表。
- 產品圖片核對中心（個人使用）：`/image-review/`，內容原樣取自 `tools/圖片核對中心.html`。
- 專屬產品選購清單（個人使用）：`/recommendation-list/`，內容原樣取自 `tools/產品選購清單.html`。

兩個個人工具頁由 `middleware.js` 的 HTTP Basic Auth 限制存取；健康問卷首頁不需登入。
登入使用者名稱固定為 `owner`，密碼保存在 Vercel 專案的 sensitive environment variable `PRIVATE_TOOLS_PASSWORD`，不存於 GitHub。
如要更換密碼，在 Vercel 修改 production/preview 環境變數並重新部署。

## 使用順序

1. 開啟 `/image-review/`，搜尋產品，從官方網站複製產品圖片或直接上傳，核准後匯出核准圖片 ZIP。
2. 開啟 `/recommendation-list/`，按「匯入圖片庫 ZIP」，讀取剛剛匯出的圖片包。
3. 透過選品名單貼上或從左側搜尋挑選產品，可直接編輯價格、文字及數量。
4. 匯出顧客版 HTML 或列印／另存 PDF。

兩個原版工具使用瀏覽器 IndexedDB 和 localStorage 保存暫存狀態；改用新的 HTTPS 域名後，原先從 `file://` 使用所保存的資料無法直接沿用，請從之前匯出的 ZIP 還原。

## GitHub 與 Vercel

GitHub：`louis200630/spa_gemini_ai`；Vercel 專案：`spa-gemini-ai`；production branch：`main`。
Git 提交到 `main` 後由 Vercel 自動建置，固定網址不變。

靜態建置指令：`npm run build`；產物：`public/`；建置腳本：`build-site.mjs`。
兩個工具均是原版 standalone HTML，使用原本離線 ZIP 實作，無須額外後端、圖片上傳服務或資料庫。

## 安全與隱私

- 工具子頁面需輸入登入帳密；不要在健康問卷中公開工具網址或密碼。
- 本網站不將圖片和客戶清單寫入雲端資料庫；圖片仍保存在使用者瀏覽器，或由使用者下載為 ZIP。
- 你的 GitHub 程式庫目前可能允許其他人檢視原始碼；網站登入不等同 GitHub 程式碼私有化。
- 純瀏覽器儲存依裝置／瀏覽器／網域而區分，請定期備份 ZIP。
