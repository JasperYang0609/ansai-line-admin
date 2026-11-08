import { useLayoutEffect, useRef } from 'react'
import {
  ArrowLeft,
  Bot,
  CornerDownLeft,
  Search,
  Send,
  UserRound,
} from 'lucide-react'
import type { Conversation, Message, Staff } from '../types'

export function ModeBadge({ mode }: { mode: 'ai' | 'human' }) {
  return (
    <span className={'mode-badge ' + mode}>
      {mode === 'ai' ? <Bot size={13} /> : <UserRound size={13} />}
      {mode === 'ai' ? 'AI 接待' : '真人處理'}
    </span>
  )
}
export function ConversationList({
  conversations,
  selectedId,
  query,
  filter,
  loading,
  onQuery,
  onFilter,
  onSelect,
  syncStatus,
}: {
  conversations: Conversation[]
  selectedId: string | null
  query: string
  filter: string
  loading: boolean
  onQuery: (value: string) => void
  onFilter: (value: string) => void
  onSelect: (id: string) => void
  syncStatus?: string
}) {
  const visible = conversations.filter(
    (c) =>
      (filter === 'all' || c.mode === filter) &&
      (c.customerName + c.preview + c.tags.join(' '))
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
  )
  return (
    <section className='conversation-list' aria-label='對話列表'>
      <div className='list-heading'>
        <div>
          <h2>收件匣</h2>
          <p>每段對話，都好好回應。</p>
        </div>
        <span className='count-pill'>{conversations.length}</span>
      </div>
      <label className='search-box'>
        <Search size={17} />
        <input
          aria-label='搜尋顧客或訊息'
          placeholder='搜尋顧客或訊息…'
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      <div className='filter-tabs' role='group' aria-label='篩選對話'>
        {[
          ['all', '全部'],
          ['ai', 'AI 接待'],
          ['human', '真人處理'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            className={filter === value ? 'active' : ''}
            onClick={() => onFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className='conversation-items'>
        {loading ? (
          <p className='empty-state' role='status'>
            正在載入對話…
          </p>
        ) : !visible.length ? (
          <p className='empty-state'>沒有符合條件的對話。</p>
        ) : (
          visible.map((c) => (
            <button
              key={c.id}
              className={
                'conversation-item ' + (selectedId === c.id ? 'selected' : '')
              }
              onClick={() => onSelect(c.id)}
              aria-current={selectedId === c.id ? 'true' : undefined}
            >
              <span className='avatar'>
                {c.customerName.replace('示範顧客：', '').slice(0, 1)}
              </span>
              <span className='conversation-summary'>
                <span className='item-top'>
                  <strong>{c.customerName}</strong>
                  <time>{formatTime(c.updatedAt)}</time>
                </span>
                <span className='preview'>{c.preview}</span>
                <span className='item-bottom'>
                  <ModeBadge mode={c.mode} />
                  {c.tags.slice(0, 1).map((tag) => (
                    <span className='tag' key={tag}>
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
              {c.unread > 0 && (
                <span
                  className='unread'
                  aria-label={c.unread + ' 則未處理訊息'}
                >
                  {c.unread}
                </span>
              )}
            </button>
          ))
        )}
      </div>
      <div className='list-footer'>
        {visible.length} 段對話 · {syncStatus ?? '示範資料'}
      </div>
    </section>
  )
}
function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '時間未知'
    : date.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
}
const statusLabels: Record<Message['status'], string> = {
  received: '已接收',
  queued: '排隊中',
  sending: '傳送中',
  sent: '已送出（平台受理）',
  unknown: '結果待確認',
  cancelled: '已取消',
  failed: '發送失敗',
}
export function ChatPanel({
  conversation,
  messages,
  staff,
  currentStaff,
  loading,
  pending,
  sendBlocked,
  readOnly,
  canLoadEarlier,
  onLoadEarlier,
  draft,
  onDraft,
  onSend,
  onMode,
  onBack,
}: {
  conversation: Conversation | undefined
  messages: Message[]
  staff: Staff[]
  currentStaff: Staff
  loading: boolean
  pending: boolean
  sendBlocked: boolean
  readOnly: boolean
  canLoadEarlier: boolean
  onLoadEarlier: () => void
  draft: string
  onDraft: (value: string) => void
  onSend: () => void
  onMode: (mode: 'ai' | 'human') => void
  onBack: () => void
}) {
  const history = useRef<HTMLDivElement>(null)
  const position = useRef({
    conversationId: '',
    firstId: '',
    height: 0,
    top: 0,
    follow: true,
  })
  useLayoutEffect(() => {
    const element = history.current
    if (!element) return
    const previous = position.current
    const changedConversation = previous.conversationId !== conversation?.id
    // 正在往上閱讀時保留位置；只有原本在底部，才跟隨新訊息。
    if (changedConversation || previous.follow)
      element.scrollTop = element.scrollHeight
    else if (previous.firstId !== messages[0]?.id)
      element.scrollTop = previous.top + element.scrollHeight - previous.height
    position.current = {
      conversationId: conversation?.id ?? '',
      firstId: messages[0]?.id ?? '',
      height: element.scrollHeight,
      top: element.scrollTop,
      follow:
        element.scrollHeight - element.scrollTop - element.clientHeight < 80,
    }
  })
  if (!conversation)
    return (
      <section className='chat-panel chat-empty'>
        <div className='empty-icon'>
          <CornerDownLeft size={28} />
        </div>
        <h2>從一段對話開始</h2>
        <p>選擇左側顧客，查看訊息與接待狀態。</p>
      </section>
    )
  const owner = staff.find((p) => p.id === conversation.assignedTo)
  const canManage =
    conversation.mode === 'ai' ||
    !conversation.assignedTo ||
    conversation.assignedTo === currentStaff.id ||
    currentStaff.role === 'admin'
  const needsClaim = conversation.mode === 'ai' || !conversation.assignedTo
  const canSend =
    !sendBlocked &&
    conversation.mode === 'human' &&
    conversation.assignedTo === currentStaff.id
  return (
    <section
      className='chat-panel'
      aria-label={'與' + conversation.customerName + '的對話'}
    >
      <header className='chat-header'>
        <button
          className='icon-button chat-back'
          aria-label='返回對話列表'
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <span className='avatar'>
          {conversation.customerName.replace('示範顧客：', '').slice(0, 1)}
        </span>
        <div className='chat-customer'>
          <h2>{conversation.customerName}</h2>
          <p>
            {conversation.mode === 'ai'
              ? '由 AI 助理接待'
              : '接手客服：' + (owner?.name ?? '待確認')}
          </p>
        </div>
        <ModeBadge mode={conversation.mode} />
      </header>
      {!readOnly && (
        <div className='handoff-bar history-notice' role='note'>
          已保存的正文長期保留，可載入較早紀錄。舊 AI
          回覆與官方帳號後台的人工回覆可能未保存。
        </div>
      )}
      {readOnly ? (
        <div className='handoff-bar history-notice' role='note'>
          已保存的正文長期保留，可載入較早紀錄。部分舊訊息、AI
          回覆與真人回覆可能未保存。
        </div>
      ) : (
        <div className='handoff-bar'>
          <span>
            {conversation.mode === 'ai'
              ? '需要時，讓真人接棒。'
              : '真人處理中，AI 暫停回覆。'}
          </span>
          <button
            className='small-button'
            disabled={pending || sendBlocked || !canManage}
            onClick={() => onMode(needsClaim ? 'human' : 'ai')}
          >
            {pending ? '處理中…' : needsClaim ? '接手對話' : '交回 AI'}
          </button>
          {conversation.mode === 'human' &&
            conversation.assignedTo !== null &&
            conversation.assignedTo !== currentStaff.id &&
            currentStaff.role === 'admin' && (
              <button
                className='small-button'
                disabled={pending || sendBlocked}
                onClick={() => onMode('human')}
              >
                由我接手
              </button>
            )}
        </div>
      )}
      <div
        className='message-history'
        ref={history}
        onScroll={(event) => {
          const element = event.currentTarget
          position.current = {
            ...position.current,
            top: element.scrollTop,
            height: element.scrollHeight,
            follow:
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80,
          }
        }}
        role='log'
        aria-label='訊息紀錄'
        aria-busy={loading}
      >
        {canLoadEarlier && (
          <button
            className='small-button'
            disabled={loading || pending}
            onClick={onLoadEarlier}
          >
            {loading ? '載入中…' : '載入較早訊息'}
          </button>
        )}
        {loading && !messages.length ? (
          <p className='empty-state' role='status'>
            正在載入訊息…
          </p>
        ) : !messages.length ? (
          <p className='empty-state'>
            {readOnly
              ? '這段對話目前沒有可顯示的保存紀錄。'
              : '這段對話還沒有訊息。'}
          </p>
        ) : (
          messages.map((m) => (
            <article key={m.id} className={'message-row ' + m.authorType}>
              <div className='message-meta'>
                {m.authorType === 'ai' ? (
                  <Bot size={14} />
                ) : (
                  <UserRound size={14} />
                )}
                <strong>{m.authorName}</strong>
                <span>
                  {m.authorType === 'ai'
                    ? 'AI 助理'
                    : m.authorType === 'agent'
                      ? '真人客服'
                      : '顧客'}
                </span>
              </div>
              <div className='message-bubble'>{m.body}</div>
              <div
                className={
                  'message-status ' + (m.status === 'failed' ? 'failed' : '')
                }
              >
                <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                <span>{statusLabels[m.status]}</span>
              </div>
            </article>
          ))
        )}
      </div>
      {!readOnly && (
        <form
          className='composer'
          onSubmit={(e) => {
            e.preventDefault()
            onSend()
          }}
        >
          <label htmlFor='reply'>
            回覆訊息
            {!canSend && (
              <span>
                {sendBlocked
                  ? ' · 發送結果待確認，暫停重送'
                  : ' · 請先接手對話'}
              </span>
            )}
          </label>
          <textarea
            id='reply'
            placeholder={
              sendBlocked
                ? '請管理員確認上一則發送結果'
                : canSend
                  ? '輸入給顧客的訊息…'
                  : '接手後即可輸入回覆'
            }
            value={draft}
            disabled={!canSend || pending || loading}
            onChange={(e) => onDraft(e.target.value)}
            rows={3}
            maxLength={10000}
          />
          <div className='composer-bottom'>
            <span>已受理不代表顧客已讀</span>
            <button
              className='primary-button'
              disabled={!canSend || pending || loading || !draft.trim()}
              type='submit'
            >
              <Send size={16} />
              {pending ? '處理中…' : '送出訊息'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
