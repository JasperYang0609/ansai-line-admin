# REA 公版架構還原與擴充接點

## 結論與範圍

這是 **React 管理介面公版，不是已接好資料庫、LINE 或客服服務的後端**。可沿用版型、路由、表格與表單元件；資料、權限、客服通道與報表仍需另接真實服務。以下依固定 upstream 基線分析，並非父任務修改後的產品驗收。

- 上游：`https://github.com/satnaing/shadcn-admin`
- 固定 commit：`e16c87f213a5ba5e45964e9b67c792105ec74d26`；package 版本 `2.2.1`。
- 日期：2026-11-06（台北）。來源由 `git archive` 匯出至工作區 output，避免混入同步修改中的 src。
- 工具：實際安裝的 **REA 6.8.0**，先讀 `rea --help` 與 `analyze-javascript-application --help`，執行原生 `analyze-javascript-application`。不是自行寫 parser 再冠上 REA。
- 未安裝工具、未改來源程式／package／Git 設定、未部署、未讀憑證或登入。僅本文件寫入新 repo；commit 由父任務統一管理。

## 原生分析與限制

原生完整分析 exit 0，耗時 **22.11 秒**。入口 TSX 試解析成功，因此不必改走公開網站 bundle；本輪沒有擷取 `shadcn-admin.netlify.app`，也不主張部署網站等於此 commit。

- 244 relevant files；235 JavaScript／TypeScript／TSX static sources。
- 原生 `parsed_javascript_files=235`；syntax complete 235、failed 0、not-examined 0。
- 同時原生 `statistics.parse_failures=2`，application unknowns 2；此與 static-source syntax 分類不同，**保留原值、不把它改寫成零錯誤**，具體原因未在本輪摘要中釐清。
- Application graph：2,968 nodes，coverage **partial**，未截斷。
- Semantic graph：**27,646 nodes、26,008 relations**；90 sources 有 semantic unknown；保留 **10,000 unknowns**。
- Semantic coverage **partial / truncated=true**：unknown 保留上限觸發；omitted nodes=0、omitted relations=0，但另省略 628 次 unknown emission（223 dynamic-call、240 data-flow、143 object-flow、22 promise）。不能由「節點未省略」推論完整還原。
- 設定全案 semantic nodes 上限 50,000、每檔 10,000；unknown 全案 10,000、每檔 1,000；單檔分析 10 秒、外層 90 秒。
- 靜態分析不證明 runtime、後端存在、權限安全、所有路由可達或第三方帳戶已開通。REA route inventory 本身標示 application_routes unknown、candidate_enumeration partial。

原始 evidence 不進 Git：`output/ansai-line-admin-20261106/rea/`（工作區根目錄下）。重要檔案：

- `baseline-native-evidence.json`：原生完整 evidence bundle（約 65.8 MB）。
- `baseline-native-summary.json`、`baseline-native-stderr.log`、`native-result.json`。
- `native-command.txt`、`help.txt`、`analyze-help.txt`：原生語法與實際命令。
- `verified-native-counts.json`、`native-coverage-extract.json`：由原生 JSON 摘出統計／路由，不是另造 REA 分析結果。
- `source-route-inventory.json`、`source-crosscheck.txt`：**另行原始碼交叉核對**，不是 REA 的輸出。
- `baseline/`：固定 commit 的唯讀分析快照。入口試解析 `native-source-*` 為先行探測，正式基線證據以上述 baseline-native 為準。

## 分層與資料流

```text
index.html → src/main.tsx
  ├─ QueryClientProvider（query/mutation 錯誤、重試與快取政策）
  ├─ Theme / Font / Direction Provider（外觀偏好）
  └─ TanStack Router → __root（Outlet / toast / error / devtools）
       ├─ auth、errors 示範頁
       ├─ _authenticated → AuthenticatedLayout
       │   └─ Search / Layout / Sidebar → features/*
       └─ clerk → ClerkProvider（需要 publishable key）
           └─ sign-in / sign-up / user-management

features/* → components/ui、data-table、forms、hooks
目前主要資料 → 本地陣列 / faker / JSON → 元件 state / table
目前表單送出 → 顯示提交資料或 sleep / toast，非持久化 API
```

`main.tsx`：React 19、Vite 8、TanStack Router／Query。`routes/__root.tsx` 提供共用錯誤與 devtools。`components/layout/*` 是外殼；`components/ui/*` 是 shadcn／Radix 與 Tailwind 4 元件。`features/*` 按功能分目錄，`stores/auth-store.ts` 用 Zustand，`hooks/*`／`lib/*` 放表格 URL 狀態、共用行為與錯誤處理；表單使用 React Hook Form + Zod，圖表用 Recharts。

## 路由完整來源清單

原始碼有 31 個 route 檔案：1 個 root + **30 個 createFileRoute 宣告**。此為此 commit 的檔案清冊，不等於 30 個獨立公開 URL；`(auth)`、`(errors)` 分組與 `_authenticated` layout 不直接成為 URL 段。依 `src/routes/**` 與 `src/routeTree.gen.ts` 對照：

- 一般登入示範：`/sign-in`、`/sign-in-2`、`/sign-up`、`/forgot-password`、`/otp`。
- 獨立錯誤頁：`/401`、`/403`、`/404`、`/500`、`/503`。
- 主工作區：`/`（dashboard）、`/tasks`、`/apps`、`/chats`、`/users`。
- 錯誤展示：`/errors/$error`，對應 unauthorized／forbidden／not-found／internal-server-error／maintenance-error；未知值回 not-found。
- `/help-center`：ComingSoon。
- 設定：`/settings`（profile）、`/settings/account`、`/settings/appearance`、`/settings/display`、`/settings/notifications`；另有 settings layout。
- Clerk：`/clerk` provider 容器、`/clerk/sign-in`、`/clerk/sign-up`、`/clerk/user-management`；另有 auth 與 authenticated layout。

新增頁面應新增 `routes` 薄入口 + `features/<module>`，再更新 `components/layout/data/sidebar-data.ts`；`routeTree.gen.ts` 是產物，勿手工當業務邏輯維護。

## 模組與資料真偽

- **Dashboard**：`features/dashboard/index.tsx`、`components/overview.tsx`、`analytics-chart.tsx`、`recent-sales.tsx`。營收／銷售是展示數字；overview 用 Math.random 產生月數值，不是真實營運／客服 KPI。
- **Tasks**：`features/tasks/data/tasks.ts` 用 faker.seed(12345) 產生 100 筆；表格支援排序／篩選／分頁，drawer 與 bulk/delete 主要展示提交或 toast/sleep，沒有任務資料庫持久化。
- **Users**：`features/users/data/users.ts` 用 faker.seed(67890) 產生 500 筆；角色／狀態為假資料，並非真正 RBAC。新增／邀請／刪除 UI 不代表已有使用者管理 API。
- **Chats**：`features/chats/index.tsx` 明確標 Fake Data，讀 `data/convo.json`；搜尋、選取與群組顯示是本地互動。不是 LINE 收發、訊息同步、客服分派、已讀或多人操作紀錄。
- **Apps**：`features/apps/data/apps.tsx` 的 connected 是寫死布林值；Connect 卡片不能當 OAuth 或第三方連線驗證。
- **Settings**：profile／account／display／notifications 多為表單示範與 showSubmittedData；Theme／Font／Direction／Layout 中的實際介面偏好會透過 cookie 等前端狀態生效，不等於已同步帳戶設定。
- **Search／Sidebar／Team switcher**：導覽與顯示資料為公版設定；sidebarData.user／teams 不是真登入帳戶或多租戶授權。
- **Errors／Help center**：共用錯誤元件與佔位頁，無客服知識庫實作。

## 認證：一般 mock + Clerk 局部真 SDK

**一般工作區未受實質認證保護。** `routes/_authenticated/route.tsx` 只有 AuthenticatedLayout；該 layout 只處理側欄與外觀，未見 session／role gate。名稱 `_authenticated` 不是安全保證。

`features/auth/sign-in/components/user-auth-form.tsx` 以 sleep(2000) 模擬成功，建立 ACC001／user role 與 mock-access-token，存入 `stores/auth-store.ts` 與 cookie；無伺服器密碼驗證。GitHub／Facebook 按鈕是示範 UI，非已接 OAuth。註冊、忘記密碼與 OTP 也有模擬等待／顯示結果，未驗證真服務。`main.tsx` 的 AxiosError 401 清狀態／轉址是錯誤處理機制，不是後端認證。

**Clerk 是局部整合，並非全站已上線：** `routes/clerk/route.tsx` 在 `VITE_CLERK_PUBLISHABLE_KEY` 存在時包 ClerkProvider，否則顯示缺 key 說明。Clerk sign-in/sign-up 使用其 SDK 元件；`clerk/_authenticated/user-management.tsx` 以 useAuth 檢查 isLoaded/isSignedIn，卻仍匯入相同 faker users 表格。故「可登入 Clerk」不等於「表格列出 Clerk 真用戶」；本輪未查 key／登入／驗證供應商連通。

## 外部服務／資產清冊

- 真 SDK 邊界：Clerk（選用、局部、未接通驗證）。
- 圖片：Chats JSON 使用 `randomuser.me` 頭像 URL；可能產生外部圖片請求，但不是聊天後端。
- Apps 假連線卡片共 15 家：Telegram、Notion、Figma、Trello、Slack、Zoom、Stripe、Gmail、Medium、Skype、Docker、GitHub、GitLab、Discord、WhatsApp。
- 登入示範另有 GitHub／Facebook 圖示；頁面含上游／文件／作者等外連，僅超連結，不等於 provider API。
- Axios／Query 是通用基礎設施；本輪來源搜尋未見業務 fetch／axios API 呼叫或 LINE、Supabase、Chatwoot adapter。不能由依賴存在宣稱已有服務。

## 繁中學員／LINE 後台的最小擴充接點（建議，未實作）

- 保留外殼與 ui/data-table/form 元件，替換 sidebar 與品牌文案；繁中日期／數字／表單錯誤文字需一起處理，不只翻選單。
- `features/students` 管學員欄位與狀態；對接明確 data adapter／API。先沿用現有 QueryClient，不為一次需求新造全域平台。
- `features/chats` 可作對話視覺起點，但必須替換 JSON 為選定客服系統／API 的資料模型；訊息 ID、客服身分、分派與狀態需以真後端為準。不得讓公版 Send 外觀冒充真 LINE 送出。
- Dashboard 只在已有真實量測來源時接上 KPI；未接前應清楚標示展示。
- 認證供應商需正式選定後，補根層 session gate 與後端權限；學生個資、跨帳號隔離、外部訊息發送需獨立安全驗證，前端角色欄位不能當授權。
- 展示階段可保留明確 mock adapter；真服務未接之前，UI 應標明 demo，避免把表單 toast 當已保存／已邀請／已傳訊。

## 驗證結語

已驗：固定 commit 快照、實際 REA 原生解析、原生 coverage/unknown/truncation、全部 route 宣告清冊與核心資料／認證／provider 原始碼交叉核對。

未驗：production 網站、真登入、真資料庫、LINE／第三方收發、持久化、多租戶安全、端到端業務流程。**這份文件是有界的公版靜態架構還原，不是完整系統或 production 完成聲明。**
