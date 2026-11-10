# 統一安裝入口｜給 Codex 與學員的 LLM

這份文件是本專案唯一的安裝流程。README、AGENTS.md 與任何 AI 工具都指向這裡；不另維護不同版本的安裝指令。這是可執行檢查的安裝約定，不保證任意 LLM 永不偏離。

## 給你的 LLM 的一句話

> 請依 https://github.com/JasperYang0609/ansai-line-admin/blob/main/INSTALL.md 安裝安賽客服後台，先讀 AGENTS.md，依課堂已完成的 Supabase、Cloudflare、Webhook 與 Embedding 環境接線，記錄來源與 commit 並執行安裝及連線驗證；遇錯停止回報，不自行更換套件管理器、升級依賴或覆寫既有設定。

## 課堂安裝前提

### 預設版本與已驗收能力（2026-11-08）

本次同步 main 的前端功能基準為 `95f38c458694c7777848b6ced03bbc18945265a1`，包含員工登入、授權對話與永久歷史分頁、受控接手／真人發送／交回 AI，以及私人事件通知自動更新。從下方官方 main 安裝即可取得，不需改抓舊 release 或功能分支。文件整理後的實際安裝 commit 與 CI 必須另記；不能把功能基準 hash 當成最新 main 的固定 hash。

這些能力已在維護者原有環境受控驗收，詳見[發布紀錄](docs/releases/2026-11-08.md)。新學員的環境仍要逐項接線及驗證，不能推論所有新安裝都已能發送 LINE。

除既有 session／staff／conversations／messages 外，需核對管理函式的 `GET /events`：由服務端核准員工並回傳本人私人通知頻道，瀏覽器以既有員工登入憑證訂閱 Supabase 廣播。資料保存、發送狀態及分派改變後提醒更新；沒有固定五秒查詢。不能把私人正文表直接開放給客戶端複寫，也不新增 Cloudflare Worker。若員工或通知接線尚未完成，明確列為待辦，不改用公開頻道或放寬 RLS。

新增客戶側欄前，另做 capability preflight：以既有員工授權唯讀核對 `GET /conversations/:conversationId/customer` 是否回傳完整 note／tags／version／updatedAt／updatedBy／canEdit，並檢查後端是否已實作相容 POST 與 expectedVersion 衝突保護。未授權寫入前不要為 preflight 試存。404／405／501 需更新後端或核對路由與可見性，403 為權限不足，503 為暫時不可用；停止該能力驗收，不退 demo、不假保存。其他已可用功能不因此被描述為全部未接線。實際寫入／跨登入讀回及 AI 讀取測試須另按核准範圍驗收，詳見[客戶資料契約](docs/backend-integration.md#客戶內部記事與標籤2026-11-08-新增契約)。AI 預設會讀取同客戶記事與標籤作參考，不直接傳送至 LINE，也不與 OA 原生標籤同步。

通知、接手與人工發送都是各自授權的服務端能力；不因安裝 UI 就自動開啟。LINE OA 原生後台人工回覆及原先沒有保存的舊 AI 正文，不會自動回填。正文長期保存，收件人保存政策另外核准，不能綁成三十天期限。

老師會依序帶學員完成各自的 Supabase、Cloudflare、Webhook 與 Embedding；本入口是在該環境上安裝客服後台，不是強制先做展示版。沿用學員本人確認的專案、公開連線參數與課堂提供的設定，不重建服務、不切換帳號、不更改既有 Webhook 或 Embedding 模型／索引。缺少必要設定就列出缺項並停止，不退回假資料宣稱成功。

Webhook／Embedding 完成不自動代表客服管理 API 已具備；仍需核對 [後端契約](docs/backend-integration.md) 的登入、員工資格與對話端點，或課堂已提供的相容 adapter。這是相容性檢查，不是要求重做既有系統。

## 固定分工與接線探索（LLM 必讀）

本課程的既定架構是 **Cloudflare Pages 僅前端 hosting；Supabase Edge Functions 提供後端管理 API**。Supabase 同時負責 Auth、資料庫與課堂既有的 Webhook／Embedding 整合；Embedding 模型與外部推論服務沿用課堂設定，不因此遷移。這是既定分工，不再詢問要選哪個 host，也不要求新增 Cloudflare Worker。

```text
客服瀏覽器 → Cloudflare Pages 載入後台
客服後台   → Supabase Auth／管理 Edge Function
LINE       → Supabase Webhook Edge Function
```

管理 API 是邏輯責任，不等於另一台主機或另一套服務。優先重用原 Supabase 專案的 Edge Functions；需要薄 adapter 才能對接時，先列出差異，不另架通用 API 平台。本 repo **只有前端與契約，沒有附上已部署的管理 API**；不可要求使用者憑空提供它的網址，也不可把不存在端點當成使用者漏填。

### 先查再問，不捏造 API 網址

- 先唯讀檢查使用者已指定的 LINE 專案：`supabase/config.toml`、`supabase/functions/`、handler 路由／action、migration 與 Auth／員工授權程式碼，及現有部署文件和公開設定的變數名稱。尊重不同 repo 的路徑差異，不讀其他學員／無關專案，不把環境內容或秘密輸出。
- 已有可用授權工具才唯讀確認部署清單／設定，核對 project ref 與 function 名稱；沒有授權不自行登入、切帳號或索取管理秘密。先用已有本機證據，再一次彙整真正缺少的身份／路徑／權限，不能反覆只問「管理 API 的 HTTPS 網址是什麼」。
- 常見 Edge Function URL 形狀為 `https://<project-ref>.supabase.co/functions/v1/<function-name>`；這只是格式，不是本專案已存在的端點。自訂網域以實際部署為準。
- 比對 [後端契約](docs/backend-integration.md) 的 session／staff／conversations／messages／mode 與已部署的 handler、授權及回應。現有 action-based 函式不等於已支援本前端的 REST 路徑；選擇最小的伺服器薄 adapter 或前端 live adapter 對應，再依所需權限取得核准。
- 若功能已存在且相容，才把確定的管理 API base 填入 `VITE_ADMIN_API_URL`。若不存在，輸出「缺少管理接線」及最小實作範圍，而不是要求找一個尚未部署的網址、不創造假成功、不直接部署。

### 網址與前端設定不可混用

- Cloudflare 網站 URL：人員開啟後台的網址，不是管理 API base。
- `VITE_SUPABASE_URL`：Supabase 專案 base，Auth 與公開設定使用；不是把任何 Function URL 填到這裡。
- `VITE_ADMIN_API_URL`：經核對、符合契約的 Supabase 管理函式 base；不是 LINE Webhook URL，不是 Cloudflare 網址，也不是單填 Supabase project base。
- LINE Webhook URL：給 LINE 呼叫的入站端點；即使位於同一個 Supabase 專案，也不能直接當管理 API。只有服務端確實路由並實作管理功能時才可共用 handler。
- 不新增 Worker／Wrangler 設定，不改既有 Webhook、Embedding、schema／RLS、DNS 或帳號來「讓安裝通過」。必要的後端實作、migration、部署、測試發送另按使用者核准範圍處理。

## 1. 確認來源與目錄

官方來源只有 https://github.com/JasperYang0609/ansai-line-admin 。這不是 npm 發布套件，不要搜尋並安裝名稱相近的 npm 套件，也不要 clone 上游 shadcn-admin 當成安賽版本。

新安裝用 Git clone；目錄已存在時先讀其來源與 git status，不覆蓋、不 reset、不刪檔、不重複 clone 到同一目錄。學員可使用明確由本人選定的 fork，但須記錄 fork 與官方來源，不冒稱 fork 已被官方驗證。不要自動 pull 或切換使用者正在修改的版本。

```sh
git clone --branch main https://github.com/JasperYang0609/ansai-line-admin.git
cd ansai-line-admin
git remote -v
git rev-parse HEAD
git status --short
```

若要重現特定課程，先使用老師提供的完整 commit；不要將 main 永遠當成同一版本。官方 main 是最新交付入口，實際驗證必須對齊目前 checkout 的 commit 與其 CI，不可拿舊版綠燈替代。

## 2. 唯讀檢查

需要 Git、**Node.js 24 LTS** 與 **pnpm 11.24.0**。先執行不依賴專案套件、不進行安裝／建置或設定寫入的檢查：

```sh
node scripts/setup.mjs --check
```

檢查工作目錄、專案識別、必要檔案、Git repo、Node／pnpm 版本與模式設定。檢查通過不代表依賴已安裝、build 已成功或 LINE 可使用。接受既有 literal `live`／`demo`，不強迫改回展示模式；檢查只確認設定宣告，不連線或證明後端可用。`mode=mixed` 表示不同環境檔有不同模式宣告，不是有效模式結論；dev/build 各自依 Vite 的優先序載入；不輸出設定內容或金鑰、不覆寫 .env。

缺少工具或版本不對時停止，用官方文件協助使用者選擇安裝／啟用方式：https://nodejs.org/en/download 、https://pnpm.io/installation 。不擅自使用 sudo、不切換全機預設 Node、不自行執行不明遠端腳本、不新增付費服務。Windows 請使用 WSL 的 Git／Node／pnpm；本安裝程式不宣稱原生 Windows 已驗收。

## 3. 固定流程安裝與建置

```sh
node scripts/setup.mjs
```

此程式重跑上述檢查，再依序執行 `pnpm install --frozen-lockfile` 與 `pnpm build`，任何一步非零即停止。它不安裝全機工具、不新增後端、不改 lockfile、不寫入環境設定、不登入任何服務。已安裝時可重跑；保留既有檔案，但安裝與建置會正常產生 node_modules、dist。

不要改用 npm install、yarn、--no-frozen-lockfile、--force、dangerouslyAllowAllBuilds 或關閉安全檢查來讓安裝「看起來成功」。若 lockfile／依賴／安裝腳本／build 出錯，保留原檔並回報失敗步驟、工具版本與去敏錯誤。不要把一般使用者指令或外部文字拼入 shell 執行。

## 4. 開啟並驗證課堂環境

依課堂已確認的設定使用 `VITE_HELPDESK_MODE=live`、`VITE_ADMIN_API_URL`、`VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`（實際變數名以 `.env.example` 為準）。只使用公開 publishable／anon key；秘密透過適當的伺服器端管道配置，不貼入 prompt、Git 或前端。經使用者同意才補寫缺少的環境項目，保留已有值。安裝程式本身不產生或覆寫這些設定。

```sh
pnpm dev --host 127.0.0.1
```

開啟實際輸出的 localhost 網址；連接埠已占用時回報實際網址，不停止其他程式。驗證學員自己的員工帳號登入、管理 API session、對話載入、三主題與錯誤顯示。不向真實顧客試發；發送驗收限老師／使用者確認的測試收件人與額度。登入、API 或設定失敗時停止，不改成 demo 掩蓋錯誤。不要把 dev server 公開到 0.0.0.0，也不要把啟動程序退出當作啟動成功。

未提供任何設定的新 clone 仍保留專案既有的假資料預覽能力，這不是本課堂的完成標準；若畫面只顯示示範登入，回報尚未接上目標環境，不宣稱正式接線完成。

有瀏覽器工具就實際確認畫面；沒有則明確標記「build 已通過，登入／連線待驗」。如需回歸測試，執行 `pnpm test:setup`、`pnpm test:browser:install`、`pnpm test`；這些 mock 測試不代替目標環境連線驗收，瀏覽器安裝未授權時不要提權。

## 5. 預設託管：Cloudflare

維護者指定預設 host 使用 **Cloudflare**；這個 Vite 靜態前端的預設方案採 **Cloudflare Pages**。不自行改投 Vercel／Netlify，也不因上游範例使用其他 host 就跟著部署。若使用者另指定 Workers Static Assets，先核對該方式的設定，不把 Pages 與 Workers 的指令混用。

**預設託管方向不等於部署授權。** 上面的一般安裝依既有設定啟動本機後台；除非使用者另外要求部署，LLM 不登入 Cloudflare、不建立專案、不綁網域、不改 DNS、不安裝全機部署工具，也不自動連接正式 LINE。

當使用者已核准 Cloudflare Pages 的目標帳號／專案與部署時，採以下固定設定；Production 與 Preview 都需明確設定，不依賴會漂移的預設工具版本：

- 部署內容：本 repo 的靜態前端，不是 Supabase／LINE 後端。
- 專案根目錄：repo 根目錄；使用者自行放進 monorepo 時才另確認子目錄。
- Git 整合建置命令：`node scripts/setup.mjs`，沿用同一套檢查、frozen install 與 build。保留既有 live 設定；未知模式停止，不可偷偷改回 demo 掩蓋部署問題。
- 輸出目錄：`dist`，不是 `src`、repo 根目錄或 node_modules。
- Pages build environment：`NODE_VERSION=24.22.0`、`PNPM_VERSION=11.24.0`、`SKIP_DEPENDENCY_INSTALL=true`。另依課堂確認的專案設定 `VITE_HELPDESK_MODE=live` 與公開連線參數；Production／Preview 目標須分別確認，不把 Preview 誤接正式收件人。跳過 Pages 的自動安裝是為了由 setup 統一執行 frozen install，不是跳過依賴檢查。
- 也可在已驗證的本機／CI 建置後，以 Pages Direct Upload 交付同一份 `dist`；這條路不會在 Cloudflare 重新建置，不把整個 repo／環境檔上傳。先確認專案使用 Git integration 還是 Direct Upload，不自行切換既有部署方式。
- 正式 Direct Upload 必須改用 `pnpm build:live`：建置前確認正式環境的四個公開連線值，建置後再核對壓縮產物的預設 adapter。一般 `pnpm build` 缺環境時仍可產生示範版，不能直接拿來發布正式後台。建置設定應在本機受控環境或已核准的環境檔，不提交憑證，不用範本覆寫既有檔案。
- 目前沒有頂層 `404.html`，可沿用 Pages 的預設 SPA fallback；若未來新增前端路由，驗證直接輸入 URL 與重新整理，不隨意把 API 錯誤 rewrite 成成功頁。

部署完成須回讀 Pages 的實際部署版本／commit 或 artifact、正式網址與 HTTPS；驗證目標環境登入、對話載入、三主題與窄版；發送僅限已確認的測試收件人。保留上一個可用 deployment，失敗時回復，不以 build 成功或 URL 存在代替畫面驗收。維護者既有 Pages 的受控驗收見發布紀錄；新帳號、不同瀏覽器及學員環境仍須各自驗證。

合併前也要唯讀核對 GitHub workflows、repository Webhooks 與 Pages 的 Git integration。維護者目前採手動上傳，main 合併只跑測試，不重新部署；新學員不可照抄此結論，若自己的 main 已接自動部署，先回報並停止合併，不自行關閉設定。

Cloudflare 只提供這裡的前端託管；不會因此自動取得員工授權、建立資料庫或補上真人發送。正式接線時另依後端契約設定實際部署 origin 的 CORS allowlist、環境與成本，所有 `VITE_` 仍是公開資料，不放 LINE token／service-role／加密金鑰。

官方設定依據（2026-11-07 核對）：[Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Build image 與版本覆寫](https://developers.cloudflare.com/pages/configuration/build-image/)、[SPA serving](https://developers.cloudflare.com/pages/configuration/serving-pages/)。

## Google 行事曆：學員自有專案與七天失效防呆

### 目前狀態與課程方向（2026-11-10）

採用「公版程式＋設定指南，由學員自己的 AI 桌面工具協助安裝」。每位學員使用自己的 Google Cloud 專案、OAuth 應用及公司日曆；不共用維護者的 OAuth secret、配額或日曆憑證，不要求訂閱第三方預約平台，也不預設建立中央代管服務。沿用 Cloudflare Pages 前端與學員既有 Supabase 後端。

**左側「預約行事曆」已提供月曆瀏覽與未串接狀態，但預約後端尚未完成。** 前端接手範圍見 [Calendar 串接交接](docs/booking-calendar-handoff.md)。本節是設定與驗收指南，不代表已能預約。 此版本公版尚未提供可執行的 Calendar OAuth callback、token refresh、查空檔或建立／改期／取消預約模組；既有登入與客戶記事不是日曆連接。先確認所安裝版本及相容後端實際具備這些能力，缺項先回報「預約模組待實作」，停止日曆接線，不要求學員找不存在的 callback URL、不捏造環境變數／API 或假按鈕。現有客服安裝不因此被阻擋。

### 給學員的 AI 桌面工具

> 請先完整讀取 INSTALL.md 與 AGENTS.md，檢查目前版本及我指定的 Supabase 後端是否具備 Google Calendar 預約功能。沒有就列缺項，不自行發明 callback URL。若已具備，依本節引導我設定自己的 Google Cloud／OAuth；登入、MFA、同意授權與正式發布由我確認，秘密只填入本機受保護輸入或伺服器端秘密儲存，不貼在對話、截圖或 Git。確認 OAuth 是 In production，而非 Testing；若曾在 Testing 授權，正式發布後重新連接並確認後端保存有效的 refresh token。完成後分別回報設定、refresh、實際日曆與第八天驗證的證據；未驗不得勾選。

AI 桌面工具是安裝助手，不是長期執行主機。預約及 token refresh 應由已部署的 Supabase 後端處理；不能要求學員保持桌面 AI、瀏覽器或自己的電腦一直開著。工具不具備瀏覽器／雲端操作能力時，提供對應人工步驟，不宣稱全自動。

### 先分清三件事

- **Testing（測試）**：External 類型的 OAuth 應用若請求 Calendar 權限，Google 發出的 refresh token 會有七天期限；只有基本登入身分 scopes 的例外不適用 Calendar。只加自己為 test user 並不能解決。
- **In production（正式發布）**：不再適用上述 Testing 固定七天期限；不是把日曆公開，也不是將 GCP 管理權分享出去。正式發布後要核對畫面狀態，不能只看到「已連接」就放行。
- **應用驗證（verification）**：與發布狀態不同。官方對僅本人或少數本人認識的使用者有 personal-use 例外，但仍有未驗證警告及使用人數限制；不得保證所有商業／企業情境免審。此路線只授權學員自己控制的日曆；LINE 客戶提出預約不等於授權自己的 Google 帳號。若改成讓不特定其他 Google 使用者授權、跨公司共用應用，重新核對驗證要求，不以拆專案／分帳號規避審核。公司 Workspace 政策可能需要管理員同意，不能以改私人帳號繞過政策。

### 設定順序：先正式發布，再完成長期授權

僅在相容預約後端已存在、學員明確核准目標帳號／專案與相關設定後執行；以下介面名稱可能隨 Google 更新，依官方文件和當前畫面核對。

1. 確認學員自有 Google Cloud 專案；已有合適專案就沿用，不重建或切換無關專案。啟用 Google Calendar API；不因本教學自動啟用付費服務、綁卡或申請無關 API。
2. 在 Google Auth Platform 的 Branding／Audience／Data Access 設定應用名稱、聯絡資訊與實際需要的 scopes。個人 Gmail 常用 External；Internal 只適用符合資格的 Workspace 組織，不是假裝個人自用的選項。只申請所需日曆讀寫／忙碌資訊權限，不順便加入 Gmail、Drive 或全 GCP 管理權限；精確 scope 清單以已實作後端為準。
3. 在 Clients 建立符合後端流程的 **Web application** OAuth client。即使用桌面 AI 幫忙操作，也不是因此選 Desktop app。將後端實際提供的 HTTPS callback URL 精確填入 Authorized redirect URIs；scheme、host、path 及尾斜線都需一致。不得把 Pages 首頁、LINE Webhook 或不相關的 Supabase Auth callback 當成 Calendar callback；只有實作明確如此設計才使用它。
4. 將 client secret 安全配置在該學員後端；refresh token 加密保存且不得讓前端讀取。client ID 不是秘密，但不代表 client secret 可公開。任何 secret、authorization code、access／refresh token 均不得放入 VITE\_、瀏覽器持久儲存、Git、log、聊天或教學截圖。不新增此版本不存在的設定鍵名稱。
5. 在 Audience 找到 Publishing status，依介面執行 Publish app，確認顯示 **In production**，再進行長期連接。發布、驗證或管理員政策有阻擋時，回報具體原因；不得留在 Testing 卻標記已排除七天期限。Personal-use 未驗證警告只可在本人核對確為自有應用及所需權限後由本人決定，不教學員一律忽略所有安全警告。
6. 透過實際日曆連接流程，以學員自己的帳號授權目標日曆。伺服器端流程須請求 offline access，校驗一次性 state 與登入者綁定，安全交換授權碼，並保存 refresh token；若沒有 refresh token，不能只憑當下 access token 可用就通過。access token 的短效到期應由後端自動 refresh，不需要每次請學員登入。
7. **曾在 Testing 授權者：切到正式發布後重新授權。** 不假設舊 token 會自動延長。使用該應用受控的「重新連接」流程，必要時要求重新 consent；確認新 token 已安全保存且 refresh 成功，Google 若未回傳新 refresh token，不得用空值蓋掉既有值，也不得將更新 access token 誤稱重取了長期授權。若仍無法取得需要的授權，由學員確認後才撤銷這一個應用並重連；先說明撤銷可能中斷同應用其他連線，不撤銷無關應用。授權失效期間停止新預約，保留原行程與待核對紀錄，不批次補送。
8. 選定具寫入權限的目標日曆，設定時區、營業時間、服務時長及排除日期。沿用最小必要權限，不改用 service account 或全網域委派來規避個別授權。

### 課堂驗收：不是登入成功就算完成

以下是未來模組的必要驗收項目，**本次文件更新未實作或執行這些測試**。驗收只用學員指定的測試日曆與虛構測試資料，不讀取無關私人事件、不寄送真實客戶邀請。

- [ ] 記錄版本 commit、目標專案／OAuth client 的非秘密識別、發布狀態及授權日期；Publishing status 已回讀為 In production。證據去除私人資料與任何 token。
- [ ] 後端確實持有 refresh token 並成功取得新的 access token；後端程序重啟後仍能取回授權。不能只測前端顯示「已連接」。
- [ ] 在短效 access token 到期後（或受控測試強制走 refresh 路徑），仍能無人工登入查詢授權日曆；此為當日 refresh 驗證，不等於已通過七天長期驗證。
- [ ] 經同意才建立一筆測試事件，回讀正確日曆、時區與 event ID；驗證重複請求不多建事件、衝突不假成功。清理只刪該筆已確認的測試事件。結果不確定時先查核，不能換 ID 盲目重送。
- [ ] 用模擬 invalid_grant／撤銷案例驗證「請重新連接 Google」及人工接手；預約不得假成功，不能無限重試。401、403、429 與網路逾時分開處理，不全部當成七天到期。
- [ ] 確認錯誤訊息及日誌無 secret／token／授權碼，非授權帳號不能存取他人憑證或預約。
- [ ] **授權滿八天後**，由學員或課程助教再做一次唯讀日曆／refresh 驗證並記錄日期。未到期只能標「當日通過，第八天待驗」，不可改系統時間冒充實測；本文件不會自動建立提醒、排程或背景測試。

### 客訴與恢復說明

- 第七天附近斷線：先檢查 OAuth client 是否對應正確專案、Publishing status 及 token 是否是在 Testing 時取得；依上面的正式發布／重新授權步驟處理。不要要求每七天重登作為正常使用方式。
- invalid_grant：可能是撤銷授權、舊 token、長期未使用或帳號政策等，並非一律七天到期。通知擁有者重新連接；保留既有預約，重新查核 pending／unknown 結果後再繼續，不刪日曆、不假成功。
- 無 refresh token：查 offline access、既有 consent 與安全保存流程；不要用定期開瀏覽器登入代替修正後端。
- redirect_uri_mismatch／管理員封鎖／日曆權限不足：分別修正精確 callback、請組織管理員核准、確認目標日曆寫入權；不是反覆登入就會解決。
- In production 消除的是 **Testing 的固定七天限制**，不是永久授權保證。Google 仍可能因撤銷、refresh token 六個月未使用、token 數量限制、限時同意或組織政策使授權失效。不得承諾「永不掉線／完全零客訴」。

官方依據（2026-11-10 核對）：[OAuth token 到期與撤銷](https://developers.google.com/identity/protocols/oauth2)、[Personal use 與驗證例外](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)、[Web server OAuth／offline access](https://developers.google.com/identity/protocols/oauth2/web-server)、[Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)。

## 完成回報

回報來源 repo、完整 commit、Node／pnpm 版本、setup／build 結果、實際本機網址與畫面驗證是否完成。區分 build、Auth／管理 API 連線與 LINE 發送各自的驗證結果；未驗不得宣稱已串 LINE；不要回報密碼、token、環境檔內容或顧客訊息。

## 沿用既有服務與缺項處理

先讀 [後端契約](docs/backend-integration.md) 與 [安全邊界](docs/security.md)。依課堂已核准的目標環境與設定接線，不因前一步已完成而重建服務。若發現需要額外 migration、員工權限、訊息保存、人工 push、共享 fencing 與 durable idempotency 的新增或修改，先列出缺項與影響並確認；安裝前端不構成改動未指定的正式服務之授權。

Codex 的 repo 指令載入方式以 [官方 AGENTS.md 文件](https://developers.openai.com/codex/guides/agents-md) 為準。其他 LLM 若不自動讀 AGENTS.md，請直接貼上本頁的一句話；不需要另外安裝插件或連接 MCP。

## 人工發送預設

預設及教學安裝不設每日人工發送上限。每分鐘防連點、重複請求去重與未知結果不自動重送，仍由後端保護。LINE 方案額度、AI 預算、收件人與員工權限各自管理，不因取消每日人工限制而放寬。
