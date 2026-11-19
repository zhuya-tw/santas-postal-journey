# 年度維護與備份

## 固定排程

每年 9–12 月，台灣時間週一、週四 09:23 查核。GitHub 可能延後排程。排程在預設分支運作，手動執行可用來補跑或重新部署。公開儲存庫長期未有活動時，GitHub 可能在 60 天後停用排程。每年 9 月初查看 Actions 是否啟用並手動跑一次，再檢視當年待審核 Issue。

[GitHub Actions 排程說明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 核對中華郵政

程式從官網的郵務消息尋找民國年度相符的公告。驗證 HTTPS 官方網域、唯一公告、唯一 PDF、年度標題、欄位順序、地區順序、完整日期和日曆有效性。新年度的表格全部通過才寫入圖鑑、留存 Git 紀錄並發布。PDF 缺頁、出現新版格式、同年度公告更動、內容擷取失敗或來源有疑義時，請從 Actions 下載 `postal-review` 並開啟近一次年度 Issue。

手動核對時，先開官方公告及原始 PDF，對照每列的六個欄位。若確認來源和欄位，才修改 `site/data/catalog.json` 的 `taiwan`。日期格式 `MM-DD`，前三欄依序是聖誕航空函件、航空包裹、快捷，後三欄是新年同順序。每次年度欄位依官方公告建立。若地方分類難以判定，請保留官方地區用語。

## 核對海外郵局

程式檢查各官網的地址與政策文字附近是否有異動。每次核對失敗、基準未核准、指紋異動或缺該年度資料，都會列入年度 Issue。近期查核報告保留 30 天。關鍵詞附近的文字變化可能與政策無關，網站動態載入的部分也可能需要在瀏覽器查看。

1. 在 Actions 下載 `postal-review`。比對報告的 `source` 與官網實際內容，檢查海外適用性、地址、回信條件與期限性質。
2. 若網站改版導致關鍵詞找不到，先更新 `config/sources.json` 的網址與 anchors，再跑一次。
3. 年度資料寫在對應郵局的 `seasons` 下。填入地址行、回信說明、查核日及官方連結。期限需有當年官方明文，填入 ISO 日期和期限型態說明，否則填 `null`。回信欄支援 `program` 與 `occasional`。
4. 對照官方內容後，把報告 `observed` 中已核准的個別值寫進 `config/baseline.json`。格式為來源 ID 對 SHA-256 字串的 JSON 物件。初次執行也使用同一流程。推送後重跑，確認待審核項目消失。
5. 如有新增官方郵局，同時新增圖鑑資料與來源設定，並在 `scripts/check_sources.py` 的 `HOSTS` 登錄官方網域。`cutoffRegion` 對應中華郵政表中正式地區名稱；僅有地理區域參考時設 `cutoffRegional: true`，適用地區仍待確認時留空。推送前執行 README 的測試。

## 公開網站備份與回復

每年留存發行版本或下載原始碼 ZIP。若要保留完整版本紀錄，用 `git clone --mirror` 備份並定期執行 `git remote update`。備份一份核對過的原始 PDF 和必要的查核報告。發現錯誤時，查看 Git 歷史並以 `git revert` 回復，或以新的提交修正資料，再手動發布。若預設分支規則限制 Actions 提交，從報告取出 `candidate` 經人工審核後走正常合併流程。

從備份重建時，匯入程式和歷年資料，重新啟用 Pages 的 GitHub Actions 發布來源與排程，再執行一次手動發布。測試 2025、2026 資料切換、複製地址、官方連結、截郵倒數及窄螢幕截郵表。
