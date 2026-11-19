# Santa’s Postal Journey｜世界聖誕郵局圖鑑

從台灣寄信給聖誕老人。繁體中文靜態網站，支援手機和電腦，提供多語關鍵字搜尋、年度切換、回信篩選、官方來源與地址複製。

目前收錄 2026 年加拿大、德國希梅爾波特、芬蘭北極圈及法國利布爾訥的官方收信資料，以及中華郵政 2025、2026 年各 24 個目的地或地區的節慶截郵表。每年郵局資料獨立留存。缺少該年度資料時，頁面顯示查核狀態，日期以官方公告為準。

## 在電腦預覽

在專案根目錄執行以下指令，再開啟 [本機網站](http://127.0.0.1:8000)。

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory site
```

## 部署到 GitHub Pages

1. 建立一個公開的 GitHub 儲存庫。將解壓後的專案內容上傳到預設分支，包含隱藏目錄 `.github`。
2. 在儲存庫 Settings → Pages → Build and deployment → Source 選擇 **GitHub Actions**。
3. 在 Actions →「圖鑑發布與郵政查核」按 **Run workflow**。首次可取消勾選官方來源查核，先發布已核對的資料。
4. 從該次執行的 `github-pages` 環境網址開啟網站，確認地址複製、年份切換和官方來源連結。每次更新網站相關檔案並推送到預設分支，Actions 會測試並發布。

[GitHub Pages 發布說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 測試與目錄

```sh
python -m unittest discover -s tests
node --test tests/catalog.test.mjs
python -m pip install -r requirements.txt
python scripts/check_sources.py --year 2026
```

- `site/` 是 Pages 的發布目錄。資料在 `site/data/catalog.json`。
- `config/` 存放官方查核設定及人工核准的指紋基準。
- `scripts/`、`tests/` 與 `.github/workflows/` 存放年度查核、測試及排程。
- [維護、審核與回復](manual/maintenance.md)
- [私人收藏室與備份](manual/private-collection.md)

網站使用原生 HTML、CSS 與 JavaScript，查核採 Python、pypdf 與 GitHub Actions。公開儲存庫可使用 GitHub Pages 和 GitHub 託管的標準執行環境。私人收藏室使用自己的 Google 帳號與可用儲存配額。整套流程可脫離 ChatGPT 執行。
