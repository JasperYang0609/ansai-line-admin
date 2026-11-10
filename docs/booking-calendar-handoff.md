# 預約行事曆｜桌面版 Codex 接手

## 無網域靜態頁增量（2026-11-10）

已增加 `templates/calendar-public-site/` 的介紹、隱私政策、服務說明及獨立錯誤頁；準備工具只產生新的本機輸出，不登入或發布。所有店名、營運者、聯絡方式、供應商與網址須依本人環境替換及核准。安裝、Firebase 免費網站設定、發布與讀回步驟只維護在 INSTALL.md，不以本文件另造流程。

新增三項 Node 靜態頁測試並加入 CI；這不代表 Firebase 已發布、Google 已授權或預約功能完成。現有行事曆 UI 與 Google 連接禁用狀態保持原樣，直到真正相容的後端及部署完成驗證。

## 本次交付（2026-11-10）

使用者要求在公版左側新增「預約行事曆」，之後由桌面版 Codex 串接功能。這次是 L2 前端頁面，不修改 Auth、DB、RLS、API、LINE 發送、正式服務或 Google 帳號。

- `src/features/helpdesk/app.tsx`：在收件匣後新增 booking tab，沿用既有側欄與行動抽屜、未儲存記事離頁保護。
- `src/features/helpdesk/components/booking-calendar.tsx` 與同名 CSS：月曆、上／下月、今天、日期選取、當日資訊面板、日曆連接／設定區。沿用三色系與響應式版型。
- 預約與設定沒有假資料，不存 localStorage；沒有 Google／預約 API 呼叫。日期依裝置時區，不宣稱可預約空檔。空白畫面顯示「預約資料尚未載入」，不是「零筆預約」。
- 「連接 Google」明確禁用；營業時段及預約長度顯示待設定，沒有假保存。功能不能只解鎖按鈕，必須先完成對應後端能力。
- 先前自有 GCP 與避免 Testing 七天期限的設定指南一併納入 INSTALL.md；INSTALL 是唯一安裝流程。

## 接手邊界

先 fetch／確認實際 GitHub commit、AGENTS.md、INSTALL.md 與 docs/backend-integration.md。這份公版是學員開源模板；安賽官方私有營運庫是另一個交付範圍，不把公司設定、憑證或客戶資料複製進來，也不能因公版完成而自動部署公司環境。

採學員自有 GCP／OAuth，由自己的 AI 桌面工具協助；不改成共用託管、第三方預約訂閱或新增 Cloudflare Worker。前端仍是 Pages，後端沿用學員既有 Supabase。當前 HelpdeskApi 不包含 Calendar 介面，本次不憑空指定 callback、端點或 secret 名稱。

下一個有界功能任務先核對實際後端，建立最小契約再串前端：

- Google 連接／重新連接、伺服器端 offline refresh 與加密憑證保存；一次性 state 綁定正確員工／租戶。OAuth 登入、正式發布、部署與秘密設定依使用者授權執行。
- 列出本人獲授權日曆、可寫入目標日曆、時區、營業時段、服務時長。狀態至少區分未連接、已連接、重新授權、權限不足、載入失敗；未讀取與零筆不能混用。
- 查空檔、客戶確認、建立／改期／取消；服務端驗資格與權限、防撞期／防重複、權威 event ID 及逾時後結果核對。只有已確認寫入成功才可讓 AI 宣告預約完成。
- 不靠 AI 猜測付款／成交，延用人工接手規則；跨帳號／跨租戶、token 失效與未知結果的負向驗證。資料模型改動 migration-first，未獲授權不得改正式 DB 或寄邀請。
- In production 後完成長期授權，曾在 Testing 授權則重新連接；驗後端 refresh、第八天唯讀回查與失效恢復，詳 INSTALL。文件承諾不等於實測，不能聲稱本次已完成。

## 驗證與回復

本機 Node 24.22.0、pnpm 11.24.0，frozen lockfile；使用既有 Chrome 跑 Vitest Browser。新增日期／閏年／跨年／今天、禁用連接、無 fetch／storage 寫入及導覽保留訊息草稿測試；三主題在 320／390／1440px 既有模組可讀性與溢位測試納入新頁。

此為公版 GitHub 交付，不是 Pages／Supabase 正式部署。回復 UI 時 revert 對應功能提交；原功能基準 a4fd3beda7bd00fab84ce14a4980925de7aab439。未改動資料、API、依賴或環境設定，不需要資料遷移。
