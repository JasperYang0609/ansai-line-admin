import { useEffect, useRef, useState } from 'react'
import type {
  CalendarApi,
  CalendarSettings,
  BookingRecord,
} from '../calendar-client'

const states = {
  unconnected: '尚未連接 Google',
  connected: '已連接 Google',
  reconnect: '需要重新授權',
}
const labels = {
  offered: '等待客戶確認',
  writing: '正在核對建立結果',
  unknown: '結果待核對，請勿重送',
  confirmed: '預約完成',
  unavailable: '時段無法安排',
  cancelled: '已取消',
}
export function CalendarManager({
  api,
  onRecords,
  onStatus,
  revision = 0,
  viewerRole,
}: {
  api: CalendarApi
  onRecords: (rows: BookingRecord[] | null) => void
  onStatus?: (status: Awaited<ReturnType<CalendarApi['status']>>) => void
  revision?: number
  viewerRole?: 'admin' | 'agent'
}) {
  const loadVersion = useRef(Symbol())
  const [syncNotice, setSyncNotice] = useState('')
  const [records, setRecords] = useState<BookingRecord[]>([])
  const [next, setNext] = useState<{ createdAt: string; id: string } | null>(
    null
  )
  const [status, setStatus] = useState<Awaited<
    ReturnType<CalendarApi['status']>
  > | null>(null)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('')
  const [calendars, setCalendars] = useState<
    Awaited<ReturnType<CalendarApi['calendars']>>['calendars']
  >([])
  const [settings, setSettings] = useState<CalendarSettings>({
    calendarId: '',
    service: '',
    rules: {
      timeZone: '',
      weekdays: [],
      opens: '',
      closes: '',
      durationMinutes: 60,
      bufferBefore: 0,
      bufferAfter: 0,
      excludedDates: [],
    },
    eligibility: 'approval',
    enabled: false,
    version: 0,
  })
  async function load(synchronize = false) {
    const version = Symbol()
    loadVersion.current = version
    setBusy(true)
    setError('')
    setSyncNotice('')
    try {
      const sync = synchronize ? await api.sync() : null
      const s = await api.status()
      if (version !== loadVersion.current) return
      setStatus(s)
      onStatus?.(s)
      const b = await api.bookings()
      if (version !== loadVersion.current) return
      setRecords(b.bookings)
      setNext(b.next ?? null)
      onRecords(b.bookings)
      if (s.canManage !== false && (s.isOwner || s.canManage === undefined)) {
        const [a, c] = await Promise.all([
          api.settings(),
          s.state === 'connected' && s.isOwner ? api.calendars() : null,
        ])
        if (version !== loadVersion.current) return
        if (a.settings) setSettings(a.settings)
        if (c) setCalendars(c.calendars)
      }
      if (sync) {
        if (sync.failed || sync.conflicts || sync.remaining) {
          setError(
            'Google 同步尚未全部完成：' +
              (sync.failed ? sync.failed + ' 筆讀取失敗；' : '') +
              (sync.conflicts
                ? sync.conflicts + ' 筆時段衝突待人工核對；'
                : '') +
              (sync.remaining ? '仍有紀錄等待後續同步；' : '') +
              '已顯示目前保存的紀錄，不能視為全部最新。'
          )
        } else {
          setSyncNotice(
            '本批 Google 同步完成：核對 ' +
              sync.checked +
              ' 筆，更新 ' +
              sync.updated +
              ' 筆，取消 ' +
              sync.cancelled +
              ' 筆。'
          )
        }
      }
    } catch {
      if (version !== loadVersion.current) return
      setError(
        synchronize
          ? 'Google 同步未完成，請確認授權、日曆權限與後端版本；原紀錄保留，不代表沒有預約。'
          : '日曆資料尚未讀取成功，請確認登入權限、後端版本與日曆設定。'
      )
      if (!synchronize) onRecords(null)
    } finally {
      if (version === loadVersion.current) setBusy(false)
    }
  }
  useEffect(() => {
    let live = true
    const version = Symbol()
    loadVersion.current = version
    void api
      .status()
      .then(async (s) => {
        if (!live || version !== loadVersion.current) return
        setStatus(s)
        onStatus?.(s)
        const b = await api.bookings()
        if (!live || version !== loadVersion.current) return
        setRecords(b.bookings)
        setNext(b.next ?? null)
        onRecords(b.bookings)
        if (s.canManage !== false && (s.isOwner || s.canManage === undefined)) {
          const [a, c] = await Promise.all([
            api.settings(),
            s.state === 'connected' && s.isOwner ? api.calendars() : null,
          ])
          if (!live || version !== loadVersion.current) return
          if (a.settings) setSettings(a.settings)
          if (c) setCalendars(c.calendars)
        }
      })
      .catch(() => {
        if (live && version === loadVersion.current)
          setError('日曆資料尚未讀取成功，請確認登入權限、後端版本與日曆設定。')
      })
    return () => {
      live = false
      loadVersion.current = Symbol()
    }
  }, [api, onRecords, onStatus])
  useEffect(() => {
    if (!revision) return
    let live = true
    const version = loadVersion.current
    void Promise.all([api.status(), api.bookings()])
      .then(([s, b]) => {
        if (!live || version !== loadVersion.current) return
        setStatus(s)
        onStatus?.(s)
        setRecords(b.bookings)
        setNext(b.next ?? null)
        onRecords(b.bookings)
      })
      .catch(() => {
        if (live && version === loadVersion.current)
          setError('最新預約暫時無法讀取，畫面保留上次的紀錄。')
      })
    return () => {
      live = false
    }
  }, [api, onRecords, onStatus, revision])
  async function older() {
    if (!next) return
    setBusy(true)
    setError('')
    try {
      const b = await api.bookings(next),
        combined = [...records, ...b.bookings]
      setRecords(combined)
      setNext(b.next ?? null)
      onRecords(combined)
    } catch {
      setError('較早預約尚未讀取成功，已載入的資料保留。')
    } finally {
      setBusy(false)
    }
  }
  async function connect() {
    setBusy(true)
    setError('')
    try {
      window.location.assign(await api.connect())
    } catch {
      setError('目前無法開啟 Google 授權，請確認管理者權限與後端設定。')
      setBusy(false)
    }
  }
  async function save() {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      const result = await api.save(settings)
      setSettings({ ...settings, version: result.version })
      setSaved('預約設定已保存。')
    } catch {
      setError('設定未保存成功；請重新讀取後核對，避免覆蓋別人的變更。')
    } finally {
      setBusy(false)
    }
  }
  const canManage = status?.canManage ?? viewerRole !== 'agent'
  const rule = (key: keyof CalendarSettings['rules'], value: unknown) =>
    setSettings({ ...settings, rules: { ...settings.rules, [key]: value } })
  return (
    <div className='surface booking-setup'>
      <h3>{!canManage ? '預約同步' : 'Google 日曆連接與預約設定'}</h3>
      <p role='status'>{status ? states[status.state] : '日曆狀態尚未讀取'}</p>
      {error && <p role='alert'>{error}</p>}
      {saved && <p role='status'>{saved}</p>}
      {syncNotice && <p role='status'>{syncNotice}</p>}
      <div className='booking-month-actions'>
        {canManage && (
          <button
            className='primary-button'
            disabled={busy}
            onClick={() => void connect()}
          >
            {status?.state === 'connected' ? '重新連接 Google' : '連接 Google'}
          </button>
        )}
        <button
          className='small-button'
          disabled={busy}
          onClick={() => void load(true)}
        >
          同步 Google 並重新整理
        </button>
      </div>
      {records
        .filter((r) => r.status === 'unknown' || r.status === 'writing')
        .map((r) => (
          <p key={r.id}>
            {r.service}：結果待核對。
            <button
              className='small-button'
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void api
                  .reconcile(r.id)
                  .then(() => load())
                  .catch(() => {
                    setError('尚無法確認原行程，已保留紀錄，不會重新建立。')
                    setBusy(false)
                  })
              }}
            >
              只核對原行程
            </button>
          </p>
        ))}
      {status && canManage && (
        <button
          className='small-button'
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void api
              .pause()
              .then(() => load())
              .catch(() => {
                setError('尚未確認暫停成功，請由管理員核對後端狀態。')
                setBusy(false)
              })
          }}
        >
          暫停自動預約
        </button>
      )}
      {next && (
        <button
          className='small-button'
          disabled={busy}
          onClick={() => void older()}
        >
          載入較早預約
        </button>
      )}
      {canManage && status?.state === 'connected' && status.isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label>
            目標日曆
            <select
              required
              value={settings.calendarId}
              onChange={(e) =>
                setSettings({ ...settings, calendarId: e.target.value })
              }
            >
              <option value=''>請選擇可寫入的日曆</option>
              {calendars
                .filter((c) => c.writable)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            預約服務名稱
            <input
              required
              maxLength={120}
              value={settings.service}
              onChange={(e) =>
                setSettings({ ...settings, service: e.target.value })
              }
            />
          </label>
          <label>
            預約時區
            <input
              required
              placeholder='例如 Asia/Taipei'
              value={settings.rules.timeZone}
              onChange={(e) => rule('timeZone', e.target.value)}
            />
          </label>
          <fieldset>
            <legend>可預約星期</legend>
            {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
              <label key={d}>
                <input
                  type='checkbox'
                  checked={settings.rules.weekdays.includes(i)}
                  onChange={(e) =>
                    rule(
                      'weekdays',
                      e.target.checked
                        ? [...settings.rules.weekdays, i]
                        : settings.rules.weekdays.filter((x) => x !== i)
                    )
                  }
                />
                {d}
              </label>
            ))}
          </fieldset>
          <label>
            開始營業
            <input
              required
              type='time'
              value={settings.rules.opens}
              onChange={(e) => rule('opens', e.target.value)}
            />
          </label>
          <label>
            結束營業
            <input
              required
              type='time'
              value={settings.rules.closes}
              onChange={(e) => rule('closes', e.target.value)}
            />
          </label>
          <label>
            每次預約分鐘
            <input
              required
              type='number'
              min={5}
              max={480}
              value={settings.rules.durationMinutes}
              onChange={(e) => rule('durationMinutes', Number(e.target.value))}
            />
          </label>
          <label>
            前緩衝分鐘
            <input
              required
              type='number'
              min={0}
              max={240}
              value={settings.rules.bufferBefore}
              onChange={(e) => rule('bufferBefore', Number(e.target.value))}
            />
          </label>
          <label>
            後緩衝分鐘
            <input
              required
              type='number'
              min={0}
              max={240}
              value={settings.rules.bufferAfter}
              onChange={(e) => rule('bufferAfter', Number(e.target.value))}
            />
          </label>
          <label>
            預約資格
            <select
              value={settings.eligibility}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  eligibility: e.target
                    .value as CalendarSettings['eligibility'],
                })
              }
            >
              <option value='approval'>客服確認資格後才能預約</option>
              <option value='open'>所有來訊客戶可預約這項服務</option>
            </select>
          </label>
          <label>
            <input
              type='checkbox'
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />
            開放這項服務的自動預約
          </label>
          <button className='primary-button' disabled={busy} type='submit'>
            保存預約設定
          </button>
        </form>
      )}
      <p className='surface-note'>
        預約以客戶確認、後端重查及建立成功為準。Google
        手動刪除或改期須同步後才會反映；重新整理會向 Google
        核對，不只是重讀舊紀錄。結果待核對時不要重送；AI
        自動改期與取消尚未提供。
      </p>
    </div>
  )
}
export function BookingRows({
  rows,
  customerName,
  actions,
}: {
  rows: BookingRecord[]
  customerName?: (row: BookingRecord) => string | undefined
  actions?: (row: BookingRecord) => React.ReactNode
}) {
  return (
    <>
      {rows.length === 0 ? (
        <p>目前載入的紀錄中沒有此日預約；若有較早紀錄，可在上方繼續載入。</p>
      ) : (
        rows.map((r) => (
          <article key={r.id}>
            <strong>{r.service}</strong>
            {customerName?.(r) && <p>{customerName(r)}</p>}
            <p>
              {new Intl.DateTimeFormat('zh-TW', {
                timeZone: r.timeZone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(r.start))}
              （{r.timeZone}）
            </p>
            <p>{labels[r.status]}</p>
            {actions?.(r)}
            {r.syncStatus === 'conflict' && (
              <p role='alert'>Google 改期後有時段衝突，請由真人核對。</p>
            )}
            {r.syncStatus === 'error' && (
              <p role='alert'>
                Google 同步異常，顯示上次保存資料，請核對授權與日曆。
              </p>
            )}
          </article>
        ))
      )}
    </>
  )
}

export function BookingEligibility({
  api,
  conversationId,
}: {
  api: CalendarApi
  conversationId: string
}) {
  const [settings, setSettings] = useState<CalendarSettings | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void api
      .settings()
      .then((v) => {
        if (live) setSettings(v.settings)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [api, conversationId])
  if (!settings || settings.eligibility !== 'approval') return null
  return (
    <section className='booking-eligibility'>
      <h3>預約資格</h3>
      <p>
        服務：{settings.service}
        。請先核對必要的訂單、付款或其他條件；核准不代表已建立行程。
      </p>
      <button
        className='small-button'
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void api
            .approve(conversationId, settings.version)
            .then(() => setNotice('已核准這位客戶預約目前服務。'))
            .catch(() => setNotice('資格未核准，請重新核對服務設定與權限。'))
            .finally(() => setBusy(false))
        }}
      >
        確認資格並允許預約
      </button>
      {notice && <p role='status'>{notice}</p>}
    </section>
  )
}
