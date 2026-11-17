# 台灣美安健康問卷網站

網站以既有的 `spa_gemini_ai.html` 為唯一問卷來源，完整保留原有的健康問卷與推薦矩陣。

## 網站部署
1. 在 Vercel 匯入 GitHub 儲存庫 `louis200630/spa_gemini_ai`。
2. Production Branch 選擇 `main`。
3. Framework Preset 選擇 Other；建置設定已寫在 `vercel.json`：
   - Build Command: `npm run build`
   - Output Directory: `public`
4. 第一次部署成功後，在 Vercel Project 的 Domains 頁面取得固定網域（或自行綁定網域）。
5. 日後只要提交 `main` 的新版 `spa_gemini_ai.html`，Vercel 就會自動重新部署，固定網址不變。

## 使用與匯出
- 問卷自動生成健康建議及產品推薦。
- 在結果頁從推薦商品按「加入客戶清單」，也可以搜尋其他產品自行加入（不改變問卷計分）。
- 「樂優選™胜肽益生亮白牙膏」只允許手動搜尋選品，功能標籤為「個人衛生」，不進營養素或推薦矩陣。
- 可匯出 UTF-8 CSV（Excel 可讀），或使用瀏覽器列印功能另存 PDF。
- 清單價格是參考售價，應以實際官網結帳為準。

## 資料與安全
- 此版本是純靜態前端，不會將健康問卷答案或客戶產品選取紀錄上傳至自建伺服器或資料庫。
- 重新整理或關閉分頁後，這次建立的客戶清單不會保留；請先匯出。
- 本專案原始碼為公開 GitHub Repo，網站上線後也可能被任何知道網址的人開啟；需要限制存取時，請另外設定身分驗證或 Vercel 專案保護。
- 原始問卷仍引用外部的 Tailwind CSS 與 Chart.js CDN。

## 本地測試
需要 Node.js：
```sh
npm run build
```
建置完成後可用靜態伺服器預覽 `public/index.html`。

## 維護原則
修改問卷邏輯或 `PRODUCT_DB` 時直接修改 `spa_gemini_ai.html`；網站建置會自動載入獨立的 `client-list.js` 匯出模組，不需要手動重新貼上匯出程式碼。
