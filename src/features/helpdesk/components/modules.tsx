import {
  Blocks,
  Bot,
  Cable,
  Code2,
  MessageSquare,
  UsersRound,
} from 'lucide-react'
import type { Conversation, Message, Staff } from '../types'

export function StaffPage({
  staff,
  loading,
}: {
  staff: Staff[]
  loading: boolean
}) {
  return (
    <section className='module-page'>
      <div className='page-eyebrow'>團隊協作</div>
      <h2>客服成員</h2>
      <p className='page-description'>查看目前帳號可存取的成員與角色。</p>
      <div className='surface'>
        <div className='surface-title'>
          <h3>團隊名單</h3>
          <span className='tag'>唯讀</span>
        </div>
        {loading ? (
          <p className='empty-state'>正在載入成員…</p>
        ) : !staff.length ? (
          <p className='empty-state'>尚未取得成員資料。</p>
        ) : (
          <ul className='staff-list'>
            {staff.map((person) => (
              <li key={person.id}>
                <span className='avatar'>{person.name.slice(0, 1)}</span>
                <div>
                  <strong>{person.name}</strong>
                  <p>{person.email}</p>
                </div>
                <span className='role-badge'>
                  {person.role === 'admin' ? '管理員' : '客服人員'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
export function ReportsPage({
  conversations,
  messages,
  demo,
}: {
  conversations: Conversation[]
  messages: Record<string, Message[]>
  demo: boolean
}) {
  const observed = Object.values(messages).flat()
  const agents = new Map<string, number>()
  observed
    .filter((m) => m.authorType === 'agent')
    .forEach((m) =>
      agents.set(m.authorName, (agents.get(m.authorName) ?? 0) + 1)
    )
  const stats = [
    { label: '已載入對話', value: conversations.length, icon: MessageSquare },
    { label: '已載入訊息', value: observed.length, icon: UsersRound },
    {
      label: 'AI 回覆訊息',
      value: observed.filter((m) => m.authorType === 'ai').length,
      icon: Bot,
    },
  ]
  return (
    <section className='module-page'>
      <div className='page-eyebrow'>營運觀察</div>
      <h2>訊息概況{demo ? '（示範）' : ''}</h2>
      <p className='page-description'>
        僅統計本次登入已開啟並載入的訊息，不代表完整歷史報表。
      </p>
      <div className='stat-grid'>
        {stats.map(({ label, value, icon: Icon }) => (
          <div className='surface stat' key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className='surface'>
        <div className='surface-title'>
          <h3>真人客服訊息數</h3>
          <span className='tag'>已載入範圍</span>
        </div>
        {!agents.size ? (
          <p className='empty-state'>
            開啟對話後，這裡會顯示已載入的真人回覆。
          </p>
        ) : (
          <ul className='report-list'>
            {[...agents].map(([name, count]) => (
              <li key={name}>
                <span>{name}</span>
                <strong>{count} 則</strong>
              </li>
            ))}
          </ul>
        )}
        <p className='surface-note'>
          未收集滿意度與回覆耗時，不產生相關績效數字。
        </p>
      </div>
    </section>
  )
}
export function SettingsPage({ demo }: { demo: boolean }) {
  return (
    <section className='module-page'>
      <div className='page-eyebrow'>系統設定</div>
      <h2>連線與工作環境</h2>
      <p className='page-description'>檢視目前工作台的連線方式。</p>
      <div className='surface'>
        <div className='surface-title'>
          <h3>
            <Cable size={19} />
            目前模式
          </h3>
          <span className={'mode-badge ' + (demo ? 'demo' : 'human')}>
            {demo ? '示範環境' : '真實 API 模式'}
          </span>
        </div>
        <h4>{demo ? '安心練習，不會傳送至 LINE' : '使用已設定的後端服務'}</h4>
        <p>
          {demo
            ? '顧客、客服與訊息皆為示範資料，重新整理頁面後會重設。'
            : '登入與查閱由後端驗證。目前只開放已保存紀錄查閱，接手、恢復 AI 與人工發送留待後續。'}
        </p>
        <p className='surface-note'>
          連線設定由專案管理員維護，此頁不會變更設定。
        </p>
      </div>
    </section>
  )
}
export function LearningPage() {
  return (
    <section className='module-page'>
      <div className='page-eyebrow'>從範例到自己的專案</div>
      <h2>學習與擴充</h2>
      <p className='page-description'>
        先理解一個流程，再加入你真正需要的功能。
      </p>
      <div className='learning-grid'>
        {[
          {
            icon: MessageSquare,
            title: '看懂客服流程',
            text: '收件匣 → 開啟對話 → 真人接手 → 回覆 → 交回 AI。先用示範模式完整操作一次。',
          },
          {
            icon: Code2,
            title: '介面與資料分開',
            text: '畫面集中在 helpdesk 功能資料夾，透過 HelpdeskApi 取得資料。更換資料來源，不必重寫每個畫面。',
          },
          {
            icon: Blocks,
            title: '從一個小功能開始',
            text: '可以先練習新增對話篩選或顯示欄位，再逐步擴充模組。帳號權限與訊息發送仍須由後端驗證。',
          },
        ].map(({ icon: Icon, title, text }) => (
          <article className='surface learning-card' key={title}>
            <span className='learning-icon'>
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className='learning-callout'>
        <strong>這是起點，不是限制。</strong>
        <p>保留開源授權，依照實際需求逐步打造自己的工作台。</p>
      </div>
    </section>
  )
}
