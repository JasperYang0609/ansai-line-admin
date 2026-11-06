# 安全基線與正式接線 Gate

## SECURITY_SCOPE／威脅模型

目前資產是公開前端程式、虛構課堂資料、可選 Supabase user bearer 與後端回傳的對話。只有 demo adapter 可離線完整使用；live 是 HTTP 用戶端，不附伺服器端點或資料庫。威脅為不可信訊息、錯誤設定、被竄改的員工身分、逾時重送、跨登入期晚到資料與相依套件漏洞。最高風險是真實對話外洩／錯發與 LINE 費用，所以正式服務未接線前不可宣稱 production-ready。

信任邊界：前端不可信；Supabase Auth 證明登入，後端每次另驗 membership／tenant／assignment／state；LINE、加解密、成本上限在伺服器。不得把 user metadata 或 UI 角色欄位當作授權。此 repo 沒有模型呼叫或工具權限，不需要另造 AI agent 控制面。

## OWASP Top 10:2025

以下是整體可用性 Gate，不以 scanner 綠燈冒充安全。Owner：repo 維護者；live BLOCKED 項由正式後端維護者簽收。

- A01 Broken Access Control — BLOCKED（live）：前端測試 401/403、版本衝突、示範雙員工；真實跨帳號／跨 tenant／RPC/RLS 尚無伺服器可測。
- A02 Security Misconfiguration — BLOCKED（live）：設定缺失拒絕，不偷偷退回 demo；公開金鑰檢查、HTTPS 與 redirect拒絕有測試。正式 CSP/CORS/headers/origin 尚未部署驗證。
- A03 Software Supply Chain Failures — PASS（本機教學候選）：保留上游固定 commit／MIT 與 lockfile。已修補初次已知漏洞，production 與包含開發／測試套件的完整 audit 各級均為 0；Node 24／pnpm 11.24.0 下 lint、格式、162 項測試與 build 成功。憑證模式掃描涵蓋候選檔案、產物及上游 1,735 個歷史 blob，無命中；非全面供應鏈認證。GitHub 遠端 CI 尚未執行。
- A04 Cryptographic Failures — BLOCKED（live）：沒有前端加解密；user bearer 僅記憶體。TLS/token/session真實環境未驗，歷史加密與 retention 需後端驗收。
- A05 Injection — PASS（client）：訊息以 React 純文字輸出，不用 innerHTML；HTML／script 訊息瀏覽器反例通過，未建立 img 或 script 元素。schema 驗證網路 DTO、1MiB 回應上限與路徑限制；無 SQL/shell 執行介面。後端 injection 防護不在本次通過範圍。
- A06 Insecure Design — BLOCKED（live）：示範與實際模式明確分離；unknown 不重送、requestId／expectedVersion 已建契約。正式 durable idempotency、共用 AI／真人鎖、預算與未知結果調和尚待後端。
- A07 Authentication Failures — BLOCKED（live）：真實模式先 Supabase Auth，再檢查 server session；無假登入 fallback，401 清 token。真實帳號／撤銷／隔離未實測。
- A08 Software or Data Integrity Failures — PASS（client）：固定版本與 lockfile，DTO 驗證、來源與 MIT 保留；本文件、測試及程式統一納入本機提交。瀏覽器傳入作者不可信。遠端 commit／CI／公開 readback 仍待 GitHub 目的地確認，不以本機成功代替。
- A09 Security Logging and Alerting Failures — BLOCKED（live）：前端不記錄訊息或 token 至 console/storage；正式 immutable author/history/audit/alerting 依後端契約驗證。
- A10 Mishandling of Exceptional Conditions — PASS（client）：ApiError 類別與通用訊息、無 fetch 自動重試、成功回傳不符契約不視為成功。401／409／0／502、無效／過大回應、舊登入晚到及切換對話晚到反例通過；unknown 鎖 send 與 handoff，刷新列表／切換對話不解鎖。真實 crash-after-dispatch 仍待後端。

## ASVS_5_0_0_REGISTER（範圍與狀態）

正式 Web/API 目標為 ASVS v5.0.0 L2，**目前未認證、未完成逐條 production 驗收**。本文不引用漂移的 master 編號，也不臆造 requirement id。

本前端受影響的 requirement 主題：輸入驗證／輸出編碼、認證／session、HTTP 安全通訊、錯誤處理、資訊保護、設定與相依完整性。前端可驗部分由 api.test.ts、介面反例、lint/build 及 reviewer 對齊證據。權限／跨 tenant、伺服器加密、資料庫、速率／成本、稽核與復原的完整 L2 register 是 live 接線前的 BLOCKED；不得用這個教學版本替代它。

## 業務邏輯濫用反例

- 未登入列對話、停權／非員工 Auth 登入、偽造 staff/tenant/author、跨對話 id。
- A 接手後 B 不能發送／恢復，AI 接待時不能人工送出、舊版本不能覆寫。
- 雙擊同 requestId 一次、改 payload 同 id 拒絕、斷線／5xx／schema 錯誤不自動重送。
- 晚到讀取不能混入新的登入期／另一段對話；登出清除畫面與草稿。
- HTML／script 訊息只顯示文字；未知／取消不標示為已讀或成功。

## 回復與發布

無 DB／雲端 migration，沒有 production 部署與外部發訊，因此現階段回復為回到上游固定 commit 或停止本機預覽。不得為回復刪除真實客戶資料。新的公開版本保留 Git 來源與 commit；網站部署／後端部署與 public repo 發布分開核准，不能以授權 GitHub 開源推定可改正式 LINE。

詳見 backend-integration.md 的資料留存／push／共用 fencing 阻擋。所有 P0/P1、相關負向反例失敗或秘密掃描發現，修復前禁止發布或宣稱完成。

## SECURITY_CLOSEOUT（本機教學候選，2026-11-06）

- 有界獨立審查曾發現 F1 未知發送重送、F2 舊登入晚到 401、F3 狀態不完整、F4 主管發送歸屬矛盾；修復後針對複核均 CLOSED。審查範圍內沒有未解 P0／P1，並非完整 production 安全認證。
- 最終同 CI 命令本機成功：pnpm lint、pnpm format:check、pnpm test（24 檔／162 項，其中 helpdesk 32 項）、pnpm build（tsc -b + Vite）。瀏覽器使用既有 Chrome；CI 使用 Playwright Chromium，遠端 CI 結果尚未取得。
- unknown 保護是當前頁面記憶體內的防呆；重整整頁／新登入／另一裝置不能依賴它。正式後端必須持久化指令與去重、共用發送 fencing、成本上限及權威調和；未驗收前保持 demo。
- 尚未建立公開 GitHub repo，未部署網站、後端、DB 或 LINE；公開目的地待維護者確認。上游自動關閉 issue 排程已改為手動觸發，不替新專案新增排程。
- 回復點為上游 e16c87f213a5ba5e45964e9b67c792105ec74d26；使用新分支檢視／回復，不用破壞性 reset 清除未提交資料。
- 此文件與程式同一提交，可由 git log --oneline 查得 exact commit；後續公開只推已檢查的 exact commit，另外取得遠端 CI 與 readback。私有審查與完整工具證據不包含於公開 repo。

### 開發工具相容性與供應鏈調整

- Vitest 與配套統一更新至 4.1.12，Faker 10.5.0；修補其餘公告涉及的傳遞依賴。minimatch 統一 11.0.1 跨過舊主版本，Node 24 符合其官方 engines；以 lint／formatter／完整測試／build 檢查消費端相容性，不只憑 audit 歸零。
- 舊 TanStack file-route generator 不由新入口使用，移除其 Vite plugin 與開發依賴，避免強制把 Zod 3 升到不相容主版。原版已生成 routeTree 與來源保留為參考，TypeScript 仍檢查；參考檔案路由的自動生成不是本教學版功能。
- pnpm 11 的 overrides 放在 pnpm-workspace.yaml，不使用已被忽略的 package.json pnpm 欄位。minimumReleaseAgeExclude 僅針對本次已核對的 seroval@1.7.8 安全修補版本，沒有全域停用 release-age 政策；新版本仍須另外審查。

### 公開與乾淨安裝補正（2026-11-06）

教學版已公開至 https://github.com/JasperYang0609/ansai-line-admin ，main 初次發布為 6121652；此狀態取代上述發布前快照的「尚未建立 repo」。首次遠端 CI 在安裝步驟遭 pnpm 11 的 ERR_PNPM_IGNORED_BUILDS 阻擋，尚未進入測試，不是產品功能測試失敗。

依 pnpm 官方 https://pnpm.io/settings/build#allowbuilds 設定 allowBuilds，只允許已檢閱並鎖定的 esbuild 0.25.11／0.27.1 安裝腳本，拒絕未使用的 @clerk/shared postinstall；未知套件仍維持預設拒絕，不設定 dangerouslyAllowAllBuilds，不降低 strictDepBuilds。原始碼、依賴版本與 lockfile 未變；修正後須取得 exact commit 的遠端 CI 結果，不能以本機已存在的 node_modules 宣稱乾淨 Linux 安裝已通過。

CI runner 固定為 Playwright 1.59.1 支援的 Ubuntu 24.04，避免 ubuntu-latest 漂移至不支援的 26.04；保留完整的瀏覽器安裝、測試與建置步驟，不以略過測試處理環境差異。
