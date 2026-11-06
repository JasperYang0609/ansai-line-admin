# 安賽 LINE 客服後台｜學員起始專案

以 shadcn-admin 的開源元件與版型為基礎，整理成繁體中文、可自行擴充的客服介面。

> **目前狀態：本機教學版＋真實 API 用戶端。不是已部署的 LINE 客服成品。**
> 預設示範模式不呼叫 LINE、不保存真實密碼、資料只存在記憶體，重整後清空。真實模式需要實作並部署下述後端契約；不能只填 Supabase URL 就使用既有 line-operator。

## 給 Codex／學員 LLM 的一句話入口

> 請依 https://github.com/JasperYang0609/ansai-line-admin/blob/main/INSTALL.md 安裝安賽客服後台，先讀 AGENTS.md，依課堂已完成的 Supabase、Cloudflare、Webhook 與 Embedding 環境接線，記錄來源與 commit 並執行安裝及連線驗證；遇錯停止回報，不自行更換套件管理器、升級依賴或覆寫既有設定。

安裝、啟動、工具版本與失敗處理統一以 [INSTALL.md](INSTALL.md) 為準；[AGENTS.md](AGENTS.md) 讓 repo 內的 coding agent 讀到相同入口。安裝程式會檢查目錄、版本及模式宣告，接受課堂既有的 live 設定，不會覆寫你的環境設定，也不會自動接線正式服務。

固定分工：**Cloudflare Pages 僅前端 hosting，Supabase Edge Functions 提供管理 API**；不需要另外新增 Cloudflare Worker。LLM 必須先查既有專案與契約，不能把 Webhook URL 當管理 API 或索取不存在的 API 網址；接線規則以 [INSTALL.md](INSTALL.md#固定分工與接線探索llm-必讀) 為準。建置／輸出與部署確認事項集中於 [INSTALL.md](INSTALL.md#5-預設託管cloudflare)。本機安裝不會自動部署。

## 已有什麼

- 繁體中文品牌介面、響應式收件匣、搜尋與訊息歷史。
- TeamFlow 三主題：星淵黑色／奶白葉影／雲曜科技，登入前後可切換；只記住外觀，不保存對話或登入資料。
- AI／真人／顧客訊息與作者、發送狀態標示。
- 示範登入、客服清單、接手／恢復 AI、版本衝突及錯誤回饋。
- 從載入的資料計算基本數量；沒有假造 CSAT、SLA 或客服品質評分。
- 透過 HelpdeskApi 隔開畫面與資料來源，可加入自己的模組。
- 真實模式使用 Supabase Auth 與 Supabase Edge Functions 的後台管理 API；設定不完整會拒絕啟動，不會偷偷退回示範。

## 架構與怎麼加功能

```text
src/main.tsx                  程式入口
src/features/helpdesk/app.tsx  繁體中文學員介面
src/features/helpdesk/types.ts 介面與後端共用的公開型別
src/features/helpdesk/api.ts   示範與真實資料介面
src/components/ui/            可直接修改的 shadcn 元件
```

新增標籤、內部備註或報表：先在 types.ts 定義資料與方法，再實作 api.ts 的示範和真實兩條路徑，最後新增 UI 與測試。伺服器仍須驗證權限，隱藏按鈕不是安全機制。

上游其他 features/routes 目前保留作原始碼參考，**不由這個應用入口對外提供**；它們不是已中文化或已接線的產品功能。原版展示數據與 Clerk 登入不會被新入口使用。舊路由產生器已移除，參考範例沿用上游生成的 routeTree；新功能預設加在 helpdesk 模組，不會自動產生檔案路由。REA 的解析與範圍見 docs/rea-architecture.md，不能把靜態分析當作後端功能驗證。

## 真實模式

請先讀 [後端契約](docs/backend-integration.md) 與 [安全／驗證邊界](docs/security.md)。

公開前端只放 Supabase publishable／anon key；**LINE token、service-role key、加密金鑰都只能留伺服器端**。瀏覽器送出的 authorId、tenantId 等不得作為權威。

既有 LINE webhook／AI／知識庫不必替換；優先在同一 Supabase 專案重用／補上受控管理 API 與完整訊息留存。真人從 OA Manager 發出的訊息與舊歷史不會自動回填。送出成功不是顧客已讀；人工 push 仍可能計入 LINE 訊息額度。

本 repo 不含私有 ansai-line-ai 程式、客戶資料、雲端設定或秘密，也未變更正式服務。課堂環境須核對後端契約或相容 adapter；未完成時回報缺項，不以假資料宣稱 live 已可用。

## 驗證

首次測試先執行 `pnpm exec playwright install chromium`；已有 Chrome 時可用 `VITEST_CHROME_CHANNEL=chrome pnpm test:helpdesk`。

```sh
pnpm test:helpdesk
pnpm lint
pnpm build
```

測試使用示範／mock，不能取代真正的雙帳號隔離、LINE 發送、AI 接手競態與資料庫權限驗收。

## 授權與來源

上游： https://github.com/satnaing/shadcn-admin
基準 commit：e16c87f213a5ba5e45964e9b67c792105ec74d26。

原版 Copyright (c) 2024 Sat Naing，MIT 原文完整保留於 LICENSE。安賽新增的教學調整亦以 MIT 提供，見 NOTICE。修改品牌不代表抹去上游版權。相依套件與素材各依其授權。

目前不宣稱原作者背書、不宣稱 REA 讓原授權失效。
