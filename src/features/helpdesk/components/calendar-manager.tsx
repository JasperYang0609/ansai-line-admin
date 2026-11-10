import { useEffect, useState } from 'react'
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
}
export function CalendarManager({
  api,
  onRecords,
}: {
  api: CalendarApi
  onRecords: (rows: BookingRecord[] | null) => void
}) {
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
  async function load() {
    setBusy(true)
    setError('')
    try {
      const s = await api.status()
      setStatus(s)
      const [a, b] = await Promise.all([api.settings(), api.bookings()])
      if (a.settings) setSettings(a.settings)
      setRecords(b.bookings)
      setNext(b.next ?? null)
      onRecords(b.bookings)
      if (s.state === 'connected' && s.isOwner)
        setCalendars((await api.calendars()).calendars)
    } catch {
      setError('日曆資料尚未讀取成功，請確認登入權限、後端版本與日曆設定。')
      onRecords(null)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let live = true
    void api
      .status()
      .then(async (s) => {
        if (!live) return
        setStatus(s)
        const [a, b] = await Promise.all([api.settings(), api.bookings()])
        if (!live) return
        if (a.settings) setSettings(a.settings)
        setRecords(b.bookings)
        setNext(b.next ?? null)
        onRecords(b.bookings)
        if (s.state === 'connected' && s.isOwner) {
          const c = await api.calendars()
          if (live) setCalendars(c.calendars)
        }
      })
      .catch(() => {
        if (live)
          setError('日曆資料尚未讀取成功，請確認登入權限、後端版本與日曆設定。')
      })
    return () => {
      live = false
    }
  }, [api, onRecords])
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
  const rule = (key: keyof CalendarSettings['rules'], value: unknown) =>
    setSettings({ ...settings, rules: { ...settings.rules, [key]: value } })
  return (
    <div className='surface booking-setup'>
      <h3>Google 日曆連接與預約設定</h3>
      <p role='status'>{status ? states[status.state] : '日曆狀態尚未讀取'}</p>
      {error && <p role='alert'>{error}</p>}
      {saved && <p role='status'>{saved}</p>}
      <div className='booking-month-actions'>
        <button
          className='primary-button'
          disabled={busy}
          onClick={() => void connect()}
        >
          {status?.state === 'connected' ? '重新連接 Google' : '連接 Google'}
        </button>
        <button
          className='small-button'
          disabled={busy}
          onClick={() => void load()}
        >
          重新讀取日曆
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
      {next && (
        <button
          className='small-button'
          disabled={busy}
          onClick={() => void older()}
        >
          載入較早預約
        </button>
      )}
      {status?.state === 'connected' && status.isOwner && (
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
        預約以客戶確認、後端重查及建立成功為準。結果待核對時不要重送；改期與取消先由真人客服核對原紀錄。
      </p>
    </div>
  )
}
export function BookingRows({ rows }: { rows: BookingRecord[] }) {
  return (
    <>
      {rows.length === 0 ? (
        <p>目前載入的紀錄中沒有此日預約；若有較早紀錄，可在上方繼續載入。</p>
      ) : (
        rows.map((r) => (
          <article key={r.id}>
            <strong>{r.service}</strong>
            <p>
              {new Intl.DateTimeFormat('zh-TW', {
                timeZone: r.timeZone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(r.start))}
              （{r.timeZone}）
            </p>
            <p>{labels[r.status]}</p>
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
