# 台灣美安健康問卷網站

正式網址：https://spa-gemini-ai.vercel.app/

## 頁面
- `/`：原始健康問卷。直接從 `spa_gemini_ai.html` 原樣建置，保留問卷題目、推薦邏輯、營養素及產品矩陣，不再載入「客戶產品清單」外掛。
- `/recommendation-list/`：獨立的「圖片與推薦清單製作」工具頁。可搜尋現有產品、手動加入品項、修改數量與說明、上傳封面與產品圖片，並匯出 PNG、CSV 或使用瀏覽器列印為 PDF。此工具不讀取問卷答案或自動推薦結果。

> 備註：因未取得先前所製作「上傳圖片＋推薦清單」頁面的原始檔，現階段子頁面是依所描述功能重新實作的獨立版本，非先前頁面逐字／逐像素搬移。

## 部署
本專案使用 GitHub + Vercel Git integration：
1. Vercel Project：`spa-gemini-ai`
2. GitHub Repo：`louis200630/spa_gemini_ai`
3. Production Branch：`main`
4. Build Command：`npm run build`
5. Output Directory：`public`

日後提交 `main` 後，Vercel 成功部署新版，固定正式網址保持不變。

## 維護方式
- 修改健康問卷題目、評分、產品或營養矩陣：直接修改 `spa_gemini_ai.html`。
- 商品主資料：子頁面的商品清單在建置時從原始 HTML 的 `PRODUCT_DB` 擷取，避免手動同步兩份。
- 樂優選™胜肽益生亮白牙膏只加在獨立工具頁的手動產品清單中，不進問卷矩陣。
- 修改子頁面：`recommendation-list.html` 與 `recommendation-list.js`。
- 建置流程：`build-site.mjs`。

## 隱私提醒
這是純前端靜態網站。工具頁圖片與商品清單在瀏覽器處理，不上傳到本站的後端，也不會儲存在本站的資料庫；重新整理可能遺失未匯出內容。

**工具子頁面目前沒有獨立登入限制。** 網址未放在公開問卷上，不等於存取控制；任何知道完整網址的人仍可能開啟工具。請勿在沒有保護機制的情況下處理敏感個人健康資料。

## 本地建置
Node.js（建議 LTS）：
```bash
npm run build
```

產出的靜態網站位於 `public/`，包含首頁與獨立工具子頁面。
