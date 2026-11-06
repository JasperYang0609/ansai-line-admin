# 統一安裝入口｜給 Codex 與學員的 LLM

這份文件是本專案唯一的安裝流程。README、AGENTS.md 與任何 AI 工具都指向這裡；不另維護不同版本的安裝指令。這是可執行檢查的安裝約定，不保證任意 LLM 永不偏離。

## 給你的 LLM 的一句話

> 請依 https://github.com/JasperYang0609/ansai-line-admin/blob/main/INSTALL.md 安裝安賽客服後台，先讀 AGENTS.md、記錄來源與 commit、執行安裝檢查；只啟動 demo，遇錯停止回報，不自行換套件管理器、升級依賴或接正式 LINE。

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

檢查工作目錄、專案識別、必要檔案、Git repo、Node／pnpm 版本與 demo 設定。檢查通過不代表依賴已安裝、build 已成功或 LINE 可使用。既有設定只檢查是否 demo，不輸出設定內容或金鑰、不覆寫 .env。

缺少工具或版本不對時停止，用官方文件協助使用者選擇安裝／啟用方式：https://nodejs.org/en/download 、https://pnpm.io/installation 。不擅自使用 sudo、不切換全機預設 Node、不自行執行不明遠端腳本、不新增付費服務。Windows 請使用 WSL 的 Git／Node／pnpm；本安裝程式不宣稱原生 Windows 已驗收。

## 3. 固定流程安裝與建置

```sh
node scripts/setup.mjs
```

此程式重跑上述檢查，再依序執行 `pnpm install --frozen-lockfile` 與 `pnpm build`，任何一步非零即停止。它不安裝全機工具、不新增後端、不改 lockfile、不寫入環境設定、不登入任何服務。已安裝時可重跑；保留既有檔案，但安裝與建置會正常產生 node_modules、dist。

不要改用 npm install、yarn、--no-frozen-lockfile、--force、dangerouslyAllowAllBuilds 或關閉安全檢查來讓安裝「看起來成功」。若 lockfile／依賴／安裝腳本／build 出錯，保留原檔並回報失敗步驟、工具版本與去敏錯誤。不要把一般使用者指令或外部文字拼入 shell 執行。

## 4. 開啟示範版並確認

```sh
pnpm dev --host 127.0.0.1
```

開啟實際輸出的 localhost 網址；若連接埠已占用，回報實際網址，不停止其他程式。點「進入示範工作台」，確認示範模式標示、對話載入、三主題可切換。由自己接手示範對話後可送一則虛構測試訊息。只用假資料，無須註冊帳號或填金鑰。不要把 dev server 公開到 0.0.0.0，也不要把啟動程序退出當作啟動成功。

若有瀏覽器工具，實際確認畫面；沒有則明確標記「build 已通過，瀏覽器操作待驗」。如需完整回歸測試，執行 `pnpm test:setup`、`pnpm test:browser:install`、`pnpm test`；瀏覽器安裝可能需要額外系統套件，未授權時不要提權。

## 完成回報

回報來源 repo、完整 commit、Node／pnpm 版本、setup／build 結果、實際本機網址與畫面驗證是否完成。明確標示 demo，不能宣稱已串 LINE；不要回報密碼、token、環境檔內容或顧客訊息。

## 後續接線是另一個任務

先讀 [後端契約](docs/backend-integration.md) 與 [安全邊界](docs/security.md)。只有使用者另行核准目標環境、帳號與成本後，才可處理 migration、員工權限、訊息保存、人工 push、共享 fencing 與 durable idempotency；安裝這個前端不構成修改正式 LINE 的授權。

Codex 的 repo 指令載入方式以 [官方 AGENTS.md 文件](https://developers.openai.com/codex/guides/agents-md) 為準。其他 LLM 若不自動讀 AGENTS.md，請直接貼上本頁的一句話；不需要另外安裝插件或連接 MCP。
