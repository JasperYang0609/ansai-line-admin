import { Bot, Cable, MessageSquare, UsersRound } from 'lucide-react'
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
          <span className='tag'>名單僅供查看</span>
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
export function SettingsPage({
  demo,
  canReply,
}: {
  demo: boolean
  canReply: boolean
}) {
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
            {demo ? '示範環境' : '正式環境'}
          </span>
        </div>
        <h4>{demo ? '安心練習，不會傳送至 LINE' : '使用團隊客服服務'}</h4>
        <p>
          {demo
            ? '顧客、客服與訊息皆為示範資料，重新整理頁面後會重設。'
            : canReply
              ? '目前帳號可查看授權對話，接手後回覆顧客，並在需要時交回 AI。每次操作仍會核對您的權限與對話狀態。'
              : '目前帳號可查看授權對話與已保存的歷史。如需接手或發送訊息，請聯絡團隊管理員核准操作權限。'}
        </p>
        <p className='surface-note'>
          連線設定由專案管理員維護，此頁不會變更設定。
        </p>
      </div>
    </section>
  )
}
export function HelpPage({ demo }: { demo: boolean }) {
  return (
    <section className='module-page'>
      <div className='page-eyebrow'>客服工作台操作指南</div>
      <h2>使用說明</h2>
      <p className='page-description'>
        查看對話、接手回覆，再把需要的工作交回 AI。
      </p>
      <div className='learning-grid'>
        {[
          {
            icon: MessageSquare,
            title: '查看對話與歷史',
            text: '從收件匣選擇顧客，查看您有權限讀取的對話。需要更早的內容時，使用「載入較早訊息」。新訊息會在即時連線正常時自動更新。',
          },
          {
            icon: UsersRound,
            title: '接手與交回 AI',
            text: '有操作權限的客服可按「接手對話」，接手期間 AI 暫停回覆。確認內容後再送出訊息；完成服務時可按「交回 AI」，由 AI 接續處理之後的新訊息。',
          },
          {
            icon: Bot,
            title: '確認發送結果',
            text: '「已送出（平台受理）」代表 LINE 已受理，不代表顧客已讀。若顯示「結果待確認」，請先聯絡管理員核對，避免再次傳送相同訊息。',
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
        <strong>{demo ? '目前是示範環境' : '資料與權限由團隊管理'}</strong>
        <p>
          {demo
            ? '這裡使用示範資料，不會傳送訊息至 LINE；重新整理頁面後會重設。'
            : '工作台只顯示您有權限查閱的紀錄。部分舊訊息及官方帳號原生後台的人工回覆可能未保存，遇到缺漏請向團隊確認。'}
        </p>
      </div>
    </section>
  )
}
