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
import {
  CustomerDetailsPanel,
  type CustomerGuard,
} from './components/customer-details'
import { ChatPanel, ConversationList } from './components/inbox'
import {
  HelpPage,
  ReportsPage,
  SettingsPage,
  StaffPage,
} from './components/modules'
import { ThemeSelector } from './theme'
import { useHelpdeskTheme, type HelpdeskTheme } from './theme-preference'
import type {
  Conversation,
  HelpdeskApi,
  HistoryCursor,
  Message,
  Staff,
} from './types'

type Tab = 'inbox' | 'staff' | 'reports' | 'settings' | 'learning'
const navigation = [
  { id: 'inbox', label: '收件匣', icon: Inbox },
  { id: 'staff', label: '客服成員', icon: UsersRound },
  { id: 'reports', label: '訊息概況', icon: ChartNoAxesCombined },
  { id: 'settings', label: '連線設定', icon: Settings2 },
  { id: 'learning', label: '使用說明', icon: BookOpen },
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
  theme,
  onThemeChange,
}: {
  api: HelpdeskApi
  onLogin: (staff: Staff) => void
  notice: string
  theme: HelpdeskTheme
  onThemeChange: (value: string) => void
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
    <main className='login-layout helpdesk-theme' data-theme={theme}>
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
          <ThemeSelector theme={theme} onChange={onThemeChange} />
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
  const { theme, changeTheme } = useHelpdeskTheme()
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
  const [historyStartReached, setHistoryStartReached] = useState<
    Record<string, boolean>
  >({})
  const [pending, setPending] = useState(false)
  const [syncState, setSyncState] = useState<
    'connected' | 'connecting' | 'error'
  >('connecting')
  const [unknownSends, setUnknownSends] = useState<Set<string>>(() => new Set())
  const customerGuard = useRef<CustomerGuard>({ dirty: false, saving: false })
  function allowCustomerLeave() {
    if (customerGuard.current.saving) {
      setError('客戶資料正在儲存，請等待結果後再離開。')
      return false
    }
    return (
      !customerGuard.current.dirty ||
      window.confirm('客戶資料尚未儲存，離開將捨棄草稿，是否繼續？')
    )
  }
  const mutationLock = useRef(false)
  const epoch = useRef(0)
  const selection = useRef(0)
  const messagesRef = useRef(messages)
  const syncContext = useRef({
    selectedId,
    tab,
    loading,
    messageLoading,
    pending,
  })
  const resumeSync = useRef(() => {})
  const menuButton = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const selected = conversations.find((c) => c.id === selectedId)
  const userId = user?.id

  const clearSession = useCallback((text = '') => {
    epoch.current++
    selection.current++
    setUser(null)
    setConversations([])
    setMessages({})
    setHistoryStartReached({})
    setStaff([])
    setDrafts({})
    setSelectedId(null)
    setChatOpen(false)
    setDrawer(false)
    setError('')
    setNotice(text)
    setLoading(false)
    setMessageLoading(false)
    setSyncState('connecting')
  }, [])
  const handleError = useCallback(
    (reason: unknown) => {
      if (
        errorStatus(reason) === 401 ||
        (api.mode === 'live' && errorStatus(reason) === 403)
      ) {
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
        (r) =>
          r.status === 'rejected' &&
          (errorStatus(r.reason) === 401 ||
            (api.mode === 'live' && errorStatus(r.reason) === 403))
      )
    ) {
      const rejected = results.find(
        (r) =>
          r.status === 'rejected' &&
          (errorStatus(r.reason) === 401 || errorStatus(r.reason) === 403)
      )
      if (rejected?.status === 'rejected') handleError(rejected.reason)
      return
    }
    if (results[0].status === 'fulfilled') {
      const allowed = new Set(results[0].value.map((item) => item.id))
      setConversations(results[0].value)
      if (api.mode === 'live')
        setMessages((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(([id]) => allowed.has(id))
          )
        )
    } else handleError(results[0].reason)
    if (results[1].status === 'fulfilled') setStaff(results[1].value)
    else handleError(results[1].reason)
    setLoading(false)
  }, [api, handleError])
  const loadMessages = useCallback(
    async (id: string, before?: HistoryCursor) => {
      const generation = epoch.current
      const request = ++selection.current
      setMessageLoading(true)
      try {
        const list = before
          ? await api.listMessages(id, before)
          : await api.listMessages(id)
        if (generation === epoch.current && request === selection.current) {
          setMessages((previous) => ({
            ...previous,
            [id]: before
              ? [
                  ...list.filter(
                    (item) =>
                      !(previous[id] ?? []).some((old) => old.id === item.id)
                  ),
                  ...(previous[id] ?? []),
                ]
              : list,
          }))
          setHistoryStartReached((previous) => ({
            ...previous,
            [id]: list.length === 0,
          }))
        }
      } catch (reason) {
        if (generation === epoch.current && request === selection.current) {
          if (api.mode === 'live' && errorStatus(reason) === 404) {
            setConversations((previous) =>
              previous.filter((item) => item.id !== id)
            )
            setMessages((previous) => ({ ...previous, [id]: [] }))
          }
          handleError(reason)
        }
      } finally {
        if (generation === epoch.current && request === selection.current)
          setMessageLoading(false)
      }
    },
    [api, handleError]
  )
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    syncContext.current = { selectedId, tab, loading, messageLoading, pending }
    resumeSync.current()
  }, [selectedId, tab, loading, messageLoading, pending])
  useEffect(() => {
    if (!userId || api.mode !== 'live' || !api.subscribe) return
    let stopped = false
    let working = false
    let dirty = false
    let channelConnected = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const generation = epoch.current
    function schedule() {
      // 只合併短時間內的通知，不定時查資料；沒有通知就沒有背景查詢。
      if (!stopped && dirty && !working && !timer)
        timer = setTimeout(() => {
          timer = undefined
          void update()
        }, 200)
    }
    function changed() {
      dirty = true
      schedule()
    }
    resumeSync.current = schedule
    async function update() {
      const context = syncContext.current
      if (
        stopped ||
        document.visibilityState === 'hidden' ||
        context.loading ||
        context.messageLoading ||
        context.pending ||
        mutationLock.current
      )
        return
      working = true
      dirty = false
      const request = selection.current
      const current = () =>
        !stopped &&
        generation === epoch.current &&
        request === selection.current &&
        !mutationLock.current
      try {
        const overview = await Promise.allSettled([
          api.listConversations(),
          api.listStaff(),
          api.getSession?.(),
        ])
        if (!current()) {
          dirty = true
          return
        }
        const denied = overview.find(
          (result) =>
            result.status === 'rejected' &&
            [401, 403].includes(errorStatus(result.reason))
        )
        if (denied?.status === 'rejected') throw denied.reason
        if (overview[0].status === 'rejected') throw overview[0].reason
        if (overview[1].status === 'rejected') throw overview[1].reason
        if (overview[2].status === 'rejected') throw overview[2].reason
        if (overview[2].value && overview[2].value.id !== userId)
          throw new Error('員工身分已變更')
        const allowed = new Set(overview[0].value.map((item) => item.id))
        const id = context.selectedId
        let incoming: Message[] = []
        if (id && allowed.has(id) && context.tab === 'inbox') {
          incoming = await api.listMessages(id)
          const known = new Set(
            (messagesRef.current[id] ?? []).map((item) => item.id)
          )
          let batch = incoming
          // 補齊斷線期間超過一頁的訊息，保留先前已載入的較早歷史。
          while (
            current() &&
            known.size &&
            batch.length === 100 &&
            !batch.some((item) => known.has(item.id))
          ) {
            const first = batch[0]
            batch = await api.listMessages(id, {
              id: first.id,
              createdAt: first.createdAt,
            })
            if (batch.some((item) => item.id === first.id))
              throw new Error('歷史分頁沒有前進')
            incoming = [...batch, ...incoming]
          }
        }
        if (!current()) {
          dirty = true
          return
        }
        setConversations(overview[0].value)
        setStaff(overview[1].value)
        if (overview[2].value) setUser(overview[2].value)
        setMessages((previous) => {
          const next = Object.fromEntries(
            Object.entries(previous).filter(([key]) => allowed.has(key))
          )
          if (id && allowed.has(id) && context.tab === 'inbox') {
            const combined = new Map(
              (next[id] ?? []).map((item) => [item.id, item])
            )
            for (const item of incoming) combined.set(item.id, item)
            next[id] = [...combined.values()].sort(
              (a, b) =>
                Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
                a.id.localeCompare(b.id)
            )
          }
          return next
        })
        if (id && !allowed.has(id)) {
          setDrafts((previous) =>
            Object.fromEntries(
              Object.entries(previous).filter(([key]) => key !== id)
            )
          )
          setSelectedId(null)
          setChatOpen(false)
        }
        if (channelConnected) setSyncState('connected')
      } catch (reason) {
        if (!current()) {
          dirty = true
          return
        }
        if ([401, 403].includes(errorStatus(reason))) handleError(reason)
        else if (errorStatus(reason) === 404 && context.selectedId) {
          const id = context.selectedId
          setMessages((previous) => ({ ...previous, [id]: [] }))
          setDrafts((previous) =>
            Object.fromEntries(
              Object.entries(previous).filter(([key]) => key !== id)
            )
          )
          setConversations((previous) =>
            previous.filter((item) => item.id !== id)
          )
          setSelectedId(null)
          setChatOpen(false)
        } else setSyncState('error')
      } finally {
        working = false
        schedule()
      }
    }
    function resume() {
      if (document.visibilityState !== 'hidden') changed()
    }
    const stopSubscription = api.subscribe(changed, (state) => {
      channelConnected = state === 'connected'
      setSyncState(state)
    })
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      stopped = true
      clearTimeout(timer)
      resumeSync.current = () => {}
      stopSubscription()
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [api, userId, handleError])
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
    if (
      (api.mode === 'live' && !user?.canReply) ||
      mutationLock.current ||
      !selected ||
      !user
    )
      return
    const conversation = selected
    const body = (drafts[conversation.id] ?? '').trim()
    if (
      unknownSends.has(conversation.id) ||
      (messages[conversation.id] ?? []).some(
        (message) =>
          message.authorType !== 'customer' &&
          ['unknown', 'sending', 'queued'].includes(message.status)
      )
    )
      return
    if (action === 'send' && (!body || [...body].length > 5000)) {
      setError('訊息需為 1～5000 字。')
      return
    }
    const generation = epoch.current
    selection.current++
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
    if (mutationLock.current || !allowCustomerLeave()) return
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
        theme={theme}
        onThemeChange={changeTheme}
        onLogin={(person) => {
          epoch.current++
          setNotice('')
          setUser(person)
          void loadOverview()
        }}
      />
    )
  return (
    <div className='helpdesk-shell helpdesk-theme' data-theme={theme}>
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
          客服工作台
          {api.mode === 'demo' && (
            <span className='workspace-edition'>示範環境</span>
          )}
        </div>
        <p className='nav-label'>工作空間</p>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={'nav-item ' + (tab === id ? 'active' : '')}
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                if (id !== tab && !allowCustomerLeave()) return
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
          {api.mode === 'demo' && (
            <div className='learning-promo'>
              <BookOpen size={18} />
              <strong>操作有疑問？</strong>
              <p>查看對話與客服協作說明。</p>
              <button
                onClick={() => {
                  if (tab !== 'learning' && !allowCustomerLeave()) return
                  setTab('learning')
                  closeDrawer()
                }}
              >
                查看操作說明 <ChevronRight size={14} />
              </button>
            </div>
          )}
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
            <ThemeSelector theme={theme} onChange={changeTheme} />
            {api.mode === 'demo' && (
              <span
                className={
                  'environment-badge ' + (api.mode === 'demo' ? 'demo' : '')
                }
              >
                <span />
                示範模式 · 不連接 LINE
              </span>
            )}
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
                syncStatus={
                  api.mode === 'live'
                    ? syncState === 'connected'
                      ? '新訊息即時更新中'
                      : syncState === 'error'
                        ? '即時連線中斷，恢復連線後自動補讀'
                        : '正在連接即時更新…'
                    : undefined
                }
                conversations={conversations}
                selectedId={selectedId}
                query={query}
                filter={filter}
                loading={loading}
                onQuery={setQuery}
                onFilter={setFilter}
                onSelect={(id) => {
                  if (id !== selectedId && !allowCustomerLeave()) return
                  setSelectedId(id)
                  void loadMessages(id)
                  setChatOpen(true)
                  setError('')
                }}
              />
              <div className='customer-chat-workspace'>
                <ChatPanel
                  conversation={selected}
                  messages={selectedId ? (messages[selectedId] ?? []) : []}
                  staff={staff}
                  currentStaff={user}
                  loading={messageLoading}
                  pending={pending}
                  canLoadEarlier={
                    !!selectedId &&
                    !!messages[selectedId]?.length &&
                    !historyStartReached[selectedId]
                  }
                  onLoadEarlier={() => {
                    const first = selectedId
                      ? messages[selectedId]?.[0]
                      : undefined
                    if (selectedId && first && !messageLoading)
                      void loadMessages(selectedId, {
                        createdAt: first.createdAt,
                        id: first.id,
                      })
                  }}
                  readOnly={api.mode === 'live' && !user?.canReply}
                  sendBlocked={
                    selectedId
                      ? unknownSends.has(selectedId) ||
                        (messages[selectedId] ?? []).some(
                          (message) =>
                            message.authorType !== 'customer' &&
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
                  onBack={() => {
                    if (!allowCustomerLeave()) return
                    setSelectedId(null)
                    selection.current++
                    setChatOpen(false)
                  }}
                />
                {selected && (
                  <CustomerDetailsPanel
                    key={selected.id}
                    api={api}
                    conversationId={selected.id}
                    customerName={selected.customerName}
                    guardRef={customerGuard}
                    onUnauthorized={handleError}
                    onSaved={(details) => {
                      setConversations((previous) =>
                        previous.map((c) =>
                          c.id === selected.id
                            ? { ...c, tags: details.tags }
                            : c
                        )
                      )
                      void loadOverview()
                    }}
                  />
                )}
              </div>
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
            <SettingsPage
              demo={api.mode === 'demo'}
              canReply={!!user.canReply}
            />
          ) : (
            <HelpPage demo={api.mode === 'demo'} />
          )}
        </main>
      </div>
    </div>
  )
}
