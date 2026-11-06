import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHelpdeskApi } from './features/helpdesk/api'
import { HelpdeskApp } from './features/helpdesk/app'
import './features/helpdesk/app.css'

const root = createRoot(document.getElementById('root')!)
try {
  const api = createHelpdeskApi()
  root.render(
    <StrictMode>
      <HelpdeskApp api={api} />
    </StrictMode>
  )
} catch {
  root.render(
    <main className='setup-error'>
      <img src='/ansai-mark.svg' alt='安賽' width='48' height='48' />
      <h1>連線設定需要確認</h1>
      <p>無法啟動目前設定的客服後台，請聯絡管理員檢查連線設定。</p>
      <p>系統不會自動改用示範資料。</p>
    </main>
  )
}
