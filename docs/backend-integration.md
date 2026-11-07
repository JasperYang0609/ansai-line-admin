# 後端接線契約與環境驗證

本文件是公開 DTO 契約。維護者既有後端已完成相容接線與受控驗收，見[發布紀錄](releases/2026-11-08.md)；這不代表學員自己的後端已存在同樣端點。API adapter 不直接讀私人正文表，LINE 發送仍由已授權的管理服務決定，不能提供假的 live 成功。

## 部署分工

Cloudflare Pages 只託管前端；管理 API 的既定目標是使用者既有 Supabase 專案的 Edge Functions，不另要求 Cloudflare Worker 或 API 主機。API base 的探索順序與設定規則以 [INSTALL.md 的固定分工與接線探索](../INSTALL.md#固定分工與接線探索llm-必讀) 為準。這份契約不是實作；需先檢查原專案 Functions 與 handler 相容性，缺少功能時列出最小 adapter 範圍，不把缺少實作誤報成使用者沒提供網址。

## URL 與身分

VITE_ADMIN_API_URL 指向受維護者控制的 HTTPS 管理 API base；其下提供以下相對路徑。VITE_SUPABASE_URL 指向所選 Supabase 專案。登入先呼叫 Supabase Auth，再以 user bearer 呼叫 GET /session 確認員工資格。一般 Auth 使用者不因此自動取得客服權限。前端不提供自行註冊／邀請權限。

每個讀寫端點都需重新驗證會員狀態、伺服器設定的 tenant/channel、物件所屬與角色；不要相信前端回傳的 staff、author、tenant、角色或 contact id。前端 session 只存記憶體，重新開啟需再登入；不把密碼、bearer、對話寫入 localStorage／cookie。現有 Supabase 正式環境不因這份契約而自動改動。

## DTO

權威型別見 src/features/helpdesk/types.ts；api.ts 的 Zod schema 驗證網路回傳。時間使用 ISO8601，id 使用 opaque 字串，顧客名可能改變或重複，不作為權限依據。

- Staff：id、name、email、role（admin/agent），只回覆經授權的目錄欄位。
- Conversation：id、customerName、preview、updatedAt、mode（ai/human）、version、assignedTo（員工 id 或 null）、unread、tags。
- Message：id、conversationId、body、createdAt、authorType（customer/ai/agent）、authorName、status（received/queued/sending/sent/failed/unknown/cancelled）。
- author 與正文寫入後不可用「目前被分派者」覆蓋。sent 代表通路受理，不代表對方已讀；unknown 不得變回 queued 自動重送。

## 端點

GET /session → Staff（server membership 驗證通過才回覆）。
GET /conversations → Conversation[]，v1 先限定最多 100 筆、有權查看的最近對話；不可用無限量 status dump。前端不代表已載入所有歷史。
GET /conversations/:id/messages → Message[]，每頁最多 100 則，依建立時間與 id 穩定排序；只有此對話授權通過後才解密。可帶 beforeAt 與 beforeId 查詢更早一頁，兩者必須一起提供。beforeAt 保留原時間精度，beforeId 使用該頁最早訊息的識別碼。分頁不設日期期限，不能把超過三十天或較舊的已保存正文隱藏。歷史缺口不能捏造或以 AI 記憶冒充完整紀錄。
GET /staff → Staff[]，只提供本 tenant 有權查看的客服資訊；不可跨租戶列全站帳號。
GET /events → { topic: string }，須驗證員工及固定租戶／通道，回傳本人專用的私人即時通知頻道；細節見下方事件通知段落。
POST /conversations/:id/mode，body = { mode: ai | human, expectedVersion: integer } → Conversation。
POST /conversations/:id/messages，body = { body: string, expectedVersion: integer, requestId: UUIDv4 } → Message（可以是 queued，之後讀取歷史確認最終狀態）。

若整合至既有 action-based Edge Function，請在服務端提供這些路徑的薄 adapter 或改寫前端 live adapter 對應已部署契約；不為此新增通用 API 平台。這些 DTO／URL 不是既有 line-operator 的直接別名。

## 發送必須成立的伺服器條件

- HUMAN_ACTIVE、分派給本人、active membership、伺服器對話版本一致，正式 send-enable 開關及額度都通過。主管應先明確接手，不冒充其他客服。
- 在交易內固定作者與正文、保存訊息並取得唯一發送權；AI／真人／接手／恢復共享同一份鎖與 fencing。
- requestId 與 tenant/author/conversation/canonical payload 綁定；相同指令重播回傳原結果，改內容則 409。去重查詢不能只放在前端。
- requestId 相同且已成功的結果，即使版本已往前，也應能授權後讀回原狀態；不得第二次呼叫 LINE。
- UTF-8 大小／文字長度、每人與每 tenant 的速率／每日 push 預算與併發由伺服器控制。前端 5000 字限制只是 UX，實際通路更嚴格時，後端須拒絕而不是靜默截字。
- 進行中的 AI 發送、未知結果或真人發送必須阻擋衝突狀態切換；不能只把資料寫進另一張表就宣稱防雙答。
- 真正非同步人工回覆通常要 push；reply token 不是長效人工發送憑證。需先核准 LINE 額度與長期保存加密 recipient 的範圍。
- 網路不明／崩潰後不自動重送；同 requestId 調和原狀態，必要時由主管核對。紀錄包含實際 wire body，不在清空暫存 outbox 後失去正文。

## HTTP 與錯誤

- 401：登入無效，前端清記憶體 session；403：沒有權限；404：不存在或不可見；409：版本／分派／發送衝突；413：過大；429：額度／速率；5xx／連線失敗：不明或不可用。
- 發送端收到 5xx、連線逾時或成功回傳不符契約，都不能假定未送出。必須鎖住重發並用權威紀錄核對。
- JSON 成功回應不可只送 200+空白，必須符合型別。登出 204 是例外。
- no-store、TLS、固定 allowlisted admin origin、Vary: Origin、明確 OPTIONS。CORS 不是權限控制，所有實際請求仍驗證 bearer。
- 不回傳 recipient、reply token、ciphertext、加密金鑰、SQL／stack trace 或 raw provider errors。

## 仍需另外取得的正式權限

新環境的 migration、員工權限、長期正文與收件人政策、人工 push 成本、正式雲端 origin／登入帳號、通知啟用及測試收件人，必須逐項確認範圍。公開前端安裝不會替學員取得、部署或自動啟用它們。

若學員自己的後端缺項尚未補齊，只能宣稱相應 UI 測試通過，受影響的 live 能力仍待接線。現有 OA Manager 人工訊息／被清掉的舊 AI 正文不會因此自動還原。

## 正文與收件人分開保存

本接線版本的客服正文長期保存。未經維護者明確核准，不得按期限清空、刪除或隱藏正文。每頁數量上限是分頁大小，不是歷史保存期限，前端提供載入較早訊息。

收件人識別碼用於人工推播路由，擷取、期限及清理須另行核准。正文查閱不依賴收件人資料仍存在，清理收件人不能連帶清空正文。

## 事件通知與畫面更新

正式前端以 Supabase 私人廣播訂閱更新提醒，沒有固定間隔的資料查詢。管理 API 提供 `GET /events → { topic: string }`；只在原有員工及伺服器租戶／通道驗證通過、且通知開關啟用時，回傳該員工專屬頻道。前端使用既有員工登入憑證訂閱，不使用服務端金鑰、不自行指定其他員工或租戶。

通知名稱為 `changed`，內容為空物件。資料保存、回覆狀態或分派變動後，服務端在同一交易內送出私人通知；不能在資料尚未提交時通知前端讀取。員工不得自行廣播。訂閱資格與通知收件人都須由服務端驗證，不能只靠頻道名稱難猜。分派變更須提醒原本可見但現在無權查閱的員工，讓前端移除舊畫面；提醒不含顧客正文或識別資訊。

同一波通知會合併讀取，正在操作時稍後補讀。新資料依識別碼合併，保留草稿、較早歷史、閱讀位置及未知發送結果鎖定。首次連線、重連與切回頁面時補讀一次，斷線期間跨頁的新訊息應補齊。通知不執行人工發送、接手或交回 AI。

官方即時連線套件固定版本，連線心跳僅確認通訊仍存在，不是固定查詢對話。通知通道不承擔客服歷史保存；短期系統通知與永久正文分開。正式啟用仍須核准 migration、管理函式及前端部署，並驗證真實接收通知，不以模擬測試冒充已上線。
