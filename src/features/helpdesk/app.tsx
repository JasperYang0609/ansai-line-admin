import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  Inbox,
  LogOut,
  Menu,
  RefreshCw,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react'
import { ChatPanel, ConversationList } from './components/inbox'
import {
  LearningPage,
  ReportsPage,
  SettingsPage,
  StaffPage,
} from './components/modules'
import type { Conversation, HelpdeskApi, Message, Staff } from './types'

type Tab = 'inbox' | 'staff' | 'reports' | 'settings' | 'learning'
const navigation = [
  { id: 'inbox', label: '收件匣', icon: Inbox },
  { id: 'staff', label: '客服成員', icon: UsersRound },
  { id: 'reports', label: '訊息概況', icon: ChartNoAxesCombined },
  { id: 'settings', label: '連線設定', icon: Settings2 },
  { id: 'learning', label: '學習與擴充', icon: BookOpen },
] as const
function errorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : 0
}
function errorText(error: unknown) {
  const status = errorStatus(error)
  if (status === 401) return '登入已過期，請重新登入。'
  if (status === 403) return '沒有操作權限，請聯絡管理員。'
  if (status === 409) return '對話狀態已更新，已重新取得資料。請確認後再操作。'
  if (status === 400) return '請檢查輸入內容，訊息需為 1～5000 字。'
  return '操作未完成，請稍後重新整理確認結果。'
}

function Login({
  api,
  onLogin,
  notice,
}: {
  api: HelpdeskApi
  onLogin: (staff: Staff) => void
  notice: string
}) {
  const [email, setEmail] = useState(
    api.mode === 'demo' ? 'teacher@example.test' : ''
  )
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function login(event?: FormEvent) {
    event?.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const session = await api.login(email, password)
      setPassword('')
      onLogin(session.staff)
    } catch {
      setPassword('')
      setError('登入失敗，請確認帳號、密碼與連線狀態。')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className='login-layout'>
      <section className='login-story'>
        <a className='brand' href='#main'>
          <img src='/ansai-mark.svg' alt='' width='42' height='42' />
          <span>
            ANSAI<span className='brand-cn'>安賽</span>
          </span>
        </a>
        <div className='login-story-copy'>
          <span className='story-eyebrow'>讓協作，更有餘裕</span>
          <h1>
            好的服務，
            <br />
            從好好對話開始。
          </h1>
          <p>
            AI 接待與真人協作，在同一個工作台。
            <br />
            把時間留給每一個真正需要你的時刻。
          </p>
          <div className='story-illustration' aria-hidden='true'>
            <span>顧客的每個提問</span>
            <ChevronRight />
            <strong>AI × 真人協作</strong>
          </div>
        </div>
        <small>ANSAI 安賽 · 客服工作台</small>
      </section>
      <section className='login-panel' id='main'>
        <div className='login-card'>
          <span className='page-eyebrow'>歡迎回來</span>
          <h2>開始今天的對話</h2>
          <p>
            {api.mode === 'demo'
              ? '先探索示範工作台，不需要真實帳號或密碼。'
              : '使用團隊提供的客服帳號登入。'}
          </p>
          {(error || notice) && (
            <div className='error-banner' role='alert'>
              {error || notice}
            </div>
          )}
          {api.mode === 'demo' ? (
            <div className='demo-login'>
              <span className='mode-badge demo'>示範模式</span>
              <label htmlFor='demo-person'>練習身分</label>
              <select
                id='demo-person'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              >
                <option value='teacher@example.test'>
                  課堂主管（示範管理員）
                </option>
                <option value='agent-a@example.test'>小安（示範客服）</option>
                <option value='agent-b@example.test'>小賽（示範客服）</option>
              </select>
              <button
                className='primary-button'
                disabled={busy}
                onClick={() => void login()}
              >
                {busy ? '正在開啟…' : '進入示範工作台'}
                <ChevronRight size={17} />
              </button>
              <p>僅供操作練習，不會傳送訊息至 LINE。</p>
            </div>
          ) : (
            <form onSubmit={(e) => void login(e)}>
              <label htmlFor='email'>電子郵件</label>
              <input
                id='email'
                type='email'
                autoComplete='username'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='請輸入團隊電子郵件'
                disabled={busy}
              />
              <label htmlFor='password'>密碼</label>
              <input
                id='password'
                type='password'
                autoComplete='current-password'
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button className='primary-button' disabled={busy} type='submit'>
                {busy ? '登入中…' : '登入工作台'}
                <ChevronRight size={17} />
              </button>
            </form>
          )}
          <p className='login-footnote'>
            {api.mode === 'demo'
              ? '示範資料會在重新整理頁面後重設。'
              : '需要帳號或協助？請聯絡團隊管理員。'}
          </p>
        </div>
      </section>
    </main>
  )
}

export function HelpdeskApp({ api }: { api: HelpdeskApi }) {
  const [user, setUser] = useState<Staff | null>(null)
  const [tab, setTab] = useState<Tab>('inbox')
  const [drawer, setDrawer] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [unknownSends, setUnknownSends] = useState<Set<string>>(() => new Set())
  const mutationLock = useRef(false)
  const epoch = useRef(0)
  const selection = useRef(0)
  const menuButton = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const selected = conversations.find((c) => c.id === selectedId)

  const clearSession = useCallback((text = '') => {
    epoch.current++
    selection.current++
    setUser(null)
    setConversations([])
    setMessages({})
    setStaff([])
    setDrafts({})
    setSelectedId(null)
    setChatOpen(false)
    setDrawer(false)
    setError('')
    setNotice(text)
    setLoading(false)
    setMessageLoading(false)
  }, [])
  const handleError = useCallback(
    (reason: unknown) => {
      if (errorStatus(reason) === 401) {
        clearSession(errorText(reason))
        void api.logout().catch(() => undefined)
      } else setError(errorText(reason))
    },
    [api, clearSession]
  )
  const loadOverview = useCallback(async () => {
    const generation = epoch.current
    setLoading(true)
    const results = await Promise.allSettled([
      api.listConversations(),
      api.listStaff(),
    ])
    if (generation !== epoch.current) return
    if (
      results.some(
        (r) => r.status === 'rejected' && errorStatus(r.reason) === 401
      )
    ) {
      handleError({ status: 401 })
      return
    }
    if (results[0].status === 'fulfilled') setConversations(results[0].value)
    else handleError(results[0].reason)
    if (results[1].status === 'fulfilled') setStaff(results[1].value)
    else handleError(results[1].reason)
    setLoading(false)
  }, [api, handleError])
  const loadMessages = useCallback(
    async (id: string) => {
      const generation = epoch.current
      const request = ++selection.current
      setMessageLoading(true)
      try {
        const list = await api.listMessages(id)
        if (generation === epoch.current && request === selection.current)
          setMessages((previous) => ({ ...previous, [id]: list }))
      } catch (reason) {
        if (generation === epoch.current && request === selection.current)
          handleError(reason)
      } finally {
        if (generation === epoch.current && request === selection.current)
          setMessageLoading(false)
      }
    },
    [api, handleError]
  )
  useEffect(() => {
    if (!drawer) return
    const container = drawerRef.current
    container?.querySelector<HTMLButtonElement>('button')?.focus()
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawer(false)
        requestAnimationFrame(() => menuButton.current?.focus())
      }
      if (event.key === 'Tab' && container) {
        const focusable = Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            'button:not([disabled])'
          )
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [drawer])
  async function refresh() {
    setError('')
    await loadOverview()
    if (selectedId) await loadMessages(selectedId)
  }
  async function mutate(action: 'send' | 'ai' | 'human') {
    if (mutationLock.current || !selected || !user) return
    const conversation = selected
    const body = (drafts[conversation.id] ?? '').trim()
    if (
      unknownSends.has(conversation.id) ||
      (messages[conversation.id] ?? []).some(
        (message) =>
          message.authorType === 'agent' &&
          ['unknown', 'sending', 'queued'].includes(message.status)
      )
    )
      return
    if (action === 'send' && (!body || [...body].length > 5000)) {
      setError('訊息需為 1～5000 字。')
      return
    }
    const generation = epoch.current
    mutationLock.current = true
    setPending(true)
    setError('')
    try {
      if (action === 'send') {
        const message = await api.sendMessage(
          conversation.id,
          body,
          conversation.version,
          crypto.randomUUID()
        )
        if (generation !== epoch.current) return
        if (['unknown', 'sending', 'queued'].includes(message.status))
          setUnknownSends((previous) => new Set(previous).add(conversation.id))
        setMessages((previous) => ({
          ...previous,
          [conversation.id]: [
            ...(previous[conversation.id] ?? []).filter(
              (m) => m.id !== message.id
            ),
            message,
          ],
        }))
        setDrafts((previous) => ({ ...previous, [conversation.id]: '' }))
      } else {
        const updated = await api.setMode(
          conversation.id,
          action,
          conversation.version
        )
        if (generation !== epoch.current) return
        setConversations((previous) =>
          previous.map((c) => (c.id === updated.id ? updated : c))
        )
      }
      await loadOverview()
    } catch (reason) {
      if (generation !== epoch.current) return
      if (
        action === 'send' &&
        (errorStatus(reason) === 0 || errorStatus(reason) >= 500)
      ) {
        setUnknownSends((previous) => new Set(previous).add(conversation.id))
        setError(
          '上一則訊息的發送結果待確認，已暫停此對話發送。請管理員確認，避免重複傳送。'
        )
      } else handleError(reason)
      if (errorStatus(reason) === 409) {
        await loadOverview()
        await loadMessages(conversation.id)
      }
    } finally {
      mutationLock.current = false
      setPending(false)
    }
  }
  async function logout() {
    if (mutationLock.current) return
    clearSession()
    try {
      await api.logout()
    } catch {
      setNotice('已離開工作台；遠端登出未確認，請聯絡管理員。')
    }
  }
  function closeDrawer() {
    setDrawer(false)
    requestAnimationFrame(() => menuButton.current?.focus())
  }
  if (!user)
    return (
      <Login
        api={api}
        notice={notice}
        onLogin={(person) => {
          epoch.current++
          setNotice('')
          setUser(person)
          void loadOverview()
        }}
      />
    )
  return (
    <div className='helpdesk-shell'>
      <a className='skip-link' href='#workspace'>
        跳至主要內容
      </a>
      {drawer && (
        <button
          className='drawer-scrim'
          aria-label='關閉導覽選單'
          onClick={closeDrawer}
        />
      )}
      <aside
        className={'sidebar ' + (drawer ? 'is-open' : '')}
        ref={drawerRef}
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer ? true : undefined}
        aria-label='主要導覽'
      >
        <div className='sidebar-brand'>
          <div className='brand'>
            <img src='/ansai-mark.svg' alt='' width='37' height='37' />
            <span>
              ANSAI<span className='brand-cn'>安賽</span>
            </span>
          </div>
          <button
            className='icon-button drawer-close'
            aria-label='關閉導覽選單'
            onClick={closeDrawer}
          >
            <X size={20} />
          </button>
        </div>
        <div className='workspace-label'>
          <span className='workspace-dot' />
          客服工作台<span className='workspace-edition'>學習版</span>
        </div>
        <p className='nav-label'>工作空間</p>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={'nav-item ' + (tab === id ? 'active' : '')}
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id)
                closeDrawer()
              }}
            >
              <Icon size={19} />
              {label}
              {id === 'inbox' && (
                <span className='nav-count'>{conversations.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className='sidebar-bottom'>
          <div className='learning-promo'>
            <BookOpen size={18} />
            <strong>從這裡，開始打造。</strong>
            <p>理解流程，再做出自己的功能。</p>
            <button
              onClick={() => {
                setTab('learning')
                closeDrawer()
              }}
            >
              探索擴充方式 <ChevronRight size={14} />
            </button>
          </div>
          <div className='user-panel'>
            <span className='avatar staff-avatar'>{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role === 'admin' ? '管理員' : '客服人員'}</span>
            </div>
            <button
              className='icon-button'
              onClick={() => void logout()}
              disabled={pending}
              aria-label='登出'
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className='workspace-shell' inert={drawer}>
        <header className='topbar'>
          <div className='topbar-title'>
            <button
              className='icon-button mobile-menu'
              aria-label='開啟導覽選單'
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
              ref={menuButton}
            >
              <Menu size={21} />
            </button>
            <span>工作空間</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((item) => item.id === tab)?.label}</strong>
          </div>
          <div className='topbar-actions'>
            <span
              className={
                'environment-badge ' + (api.mode === 'demo' ? 'demo' : '')
              }
            >
              <span />
              {api.mode === 'demo' ? '示範模式 · 不連接 LINE' : '真實 API 模式'}
            </span>
            <button
              className='icon-button'
              aria-label='重新整理資料'
              disabled={loading || messageLoading || pending}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {error && (
          <div className='error-banner workspace-error' role='alert'>
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label='關閉錯誤提示'>
              <X size={17} />
            </button>
          </div>
        )}
        <main
          id='workspace'
          tabIndex={-1}
          className={
            'workspace-content ' +
            (tab === 'inbox'
              ? 'inbox-layout ' + (chatOpen ? 'chat-open' : '')
              : '')
          }
        >
          {tab === 'inbox' ? (
            <>
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                query={query}
                filter={filter}
                loading={loading}
                onQuery={setQuery}
                onFilter={setFilter}
                onSelect={(id) => {
                  setSelectedId(id)
                  void loadMessages(id)
                  setChatOpen(true)
                  setError('')
                }}
              />
              <ChatPanel
                conversation={selected}
                messages={selectedId ? (messages[selectedId] ?? []) : []}
                staff={staff}
                currentStaff={user}
                loading={messageLoading}
                pending={pending}
                sendBlocked={
                  selectedId
                    ? unknownSends.has(selectedId) ||
                      (messages[selectedId] ?? []).some(
                        (message) =>
                          message.authorType === 'agent' &&
                          ['unknown', 'sending', 'queued'].includes(
                            message.status
                          )
                      )
                    : false
                }
                draft={selectedId ? (drafts[selectedId] ?? '') : ''}
                onDraft={(value) => {
                  if (selectedId)
                    setDrafts((previous) => ({
                      ...previous,
                      [selectedId]: value,
                    }))
                }}
                onSend={() => void mutate('send')}
                onMode={(mode) => void mutate(mode)}
                onBack={() => setChatOpen(false)}
              />
            </>
          ) : tab === 'staff' ? (
            <StaffPage staff={staff} loading={loading} />
          ) : tab === 'reports' ? (
            <ReportsPage
              conversations={conversations}
              messages={messages}
              demo={api.mode === 'demo'}
            />
          ) : tab === 'settings' ? (
            <SettingsPage demo={api.mode === 'demo'} />
          ) : (
            <LearningPage />
          )}
        </main>
      </div>
    </div>
  )
}
