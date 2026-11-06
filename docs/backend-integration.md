# 後端接線契約（尚待實作／部署）

本文件是公開 DTO 契約，不是目前既有後端已具備的端點。API adapter 不會直接讀資料庫、不會發送 LINE，也不提供假的 live 成功。

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
GET /conversations/:id/messages → Message[]，v1 最多 100 則，依建立時間與 id 穩定排序；只有此對話授權通過後才解密。歷史缺口不能捏造或以 AI 記憶冒充完整紀錄。
GET /staff → Staff[]，只提供本 tenant 有權查看的客服資訊；不可跨租戶列全站帳號。
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

現有服務的 migration、員工權限硬化、長期收件人／AI／真人正文保存、人工 push 成本與 retention、正式雲端 origin／登入帳號及測試收件人，必須先確認範圍。這個教學版沒有取得、部署或自動啟用它們。

在這些後端缺口補齊前，本 repo 的課堂示範可驗證 UI，但整案 live 功能為 BLOCKED；不是已接好 LINE 的正式客服。現有 OA Manager 人工訊息／被清掉的舊 AI 正文都不會因此自動還原。
