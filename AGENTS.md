# 安賽客服後台｜所有 coding agents 的共同入口

適用 Codex、Claude Code 與其他讀取 repository instructions 的 LLM。未自動讀取本檔的工具，請由使用者提供 INSTALL.md 的一句話入口；本檔不是能強制所有模型行為的執行沙箱。

- 安裝、啟動與失敗處理的唯一流程是 [INSTALL.md](INSTALL.md)：完整讀取後才安裝。不另造平行指令。
- Canonical repo：https://github.com/JasperYang0609/ansai-line-admin 。先核對 repo、branch、HEAD 與 git status；保留使用者未提交工作。
- 預設僅 demo。不要自動新增帳號／secret／DB／雲端服務、部署或操作 LINE。live 接線需另外核准，先讀 docs/backend-integration.md 與 docs/security.md。
- 使用 lockfile 與 packageManager 指定的 pnpm；安裝錯誤 fail closed，不換 npm/yarn、不改 lockfile 或停用安全機制掩蓋問題。
- 所有 VITE\_ 值都是公開的；LINE token、service-role、加密金鑰不進前端、Git、log 或 prompt。
- 不把前端 staff/author/tenant/role 當作伺服器授權；不移除未知發送結果鎖定，不因 timeout/5xx 自動重送。
- 保留 LICENSE、NOTICE 與上游 MIT 聲明。
- 前端功能在 src/features/helpdesk；上游其他 routes/features 只是參考，不是本應用入口。三套主題只控制外觀，不改 API／身分／對話狀態。
- 改動後執行受影響測試及必要 lint/typecheck/build；新安裝須有 setup 結果，發布須有 exact commit 的 CI 與回讀。未實際驗證的功能明確標記未驗，不能以 demo 代替 live 驗收。
