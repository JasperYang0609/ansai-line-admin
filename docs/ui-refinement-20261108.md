# 客服工作台面板與層次微調（2026-11-08）

L1 已核准外觀修正，基線 `c6700529b5e3e891b7ec740358b4ae05c5ce2491`。不改 API、Auth、DB、LINE、模型、hosting、依賴或 lockfile；沿用 [security.md](security.md) 安全基線，本次只驗外觀與既有安全提示／鎖定仍可用，不宣稱新的正式安全驗收。

## 已完成

- [x] 桌面外距 16px、面板間距 12px；手機外距縮為 8px，保留回覆空間。
- [x] 收件匣、聊天、客戶資料各自 16px 圓角、主題邊框與輕陰影；內層欄位／訊息不加陰影。
- [x] 控制項 10px、狀態膠囊圓角；選中對話採內縮主題色塊，移除左側藍線與逐列硬分隔。
- [x] 聊天寬度大於旁欄，桌面訊息寬度上限 62ch／85%（手機 90%）；標頭與輔助文字縮緊，保存限制、未知發送、投遞非已讀提示全部保留。
- [x] Composer 整合為單一圓角框，送出在右下；鍵盤焦點以整框呈現。
- [x] 暱稱 20px 突出於記事／標籤群組上方，儲存 primary、重新載入 secondary；草稿／衝突／權限行為不變。
- [x] 星淵黑色、奶白葉影、雲曜科技原色盤與文字對比保留。

來源：唯讀參考自有 TeamFlow `department-dashboard-cloudflare-demo/dist/index.html` 的 `.card`（28px、細邊框與陰影）、`.desktopProjectCard`（24px）及 `.desktopWorkspace`（16px gap）；只採面板層次並調成高密度客服的 16px／10px，不複製裝飾背景或動畫。

## 驗證

- 新增七個 viewport 案例：320／390／768／1024／1280／1440／1920，每例遍歷三主題。斷言真實 DOM 幾何、16px 面板圓角／邊框／陰影、10px controls、12px 間距、手機返回與抽屜、無水平溢位、聊天可用高度、送出位置、暱稱層次與提示保留。
- 既有對比測試檢查可見非停用文字 ≥4.5:1、selector focus／border ≥3:1；沿用主題切換不清草稿或 unknown send／handoff lock、記事保存／409／權限／XSS／切客戶反例。
- 執行環境：Node 24.22.0、pnpm 11.24.0、`VITEST_CHROME_CHANNEL=chrome`，本機虛構 demo／API fixtures。
- 最終 `pnpm test:helpdesk`：7 檔／126 項通過（含 14 項主題瀏覽器測試及 33 項客戶資料測試）；`pnpm lint`、`pnpm format:check`、`pnpm build`（TypeScript + Vite）、`git diff --check` 通過。完整 logs 保存在忽略的 `logs/teamflow-*.log`，未重跑不受影響的全庫測試。

## 範圍限制與交接

僅本機 Chrome 桌面／手機寬度模擬；未驗實體手機、Safari、正式登入、真實訊息／LINE／AI。手機與平板保留既有客戶資料置於聊天下方的捲動模式，未新增抽屜流程。沒有 push／merge／deploy；父級負責獨立視覺證據與發布。回復可撤回此純前端提交，不刪除後端資料。
