import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import type { CalendarApi, BookingRecord } from '../calendar-client'
import type { Conversation } from '../types'
import './booking-calendar.css'
import { CalendarManager, BookingRows } from './calendar-manager'
import { StaffBookingEditor, type BookingEdit } from './staff-booking-editor'

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long' }).format(
    date
  )
const dateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** 日期瀏覽保留；實際資料只由已登入的後端介面提供。 */
export function BookingCalendarPage({
  calendar,
  conversations = [],
  revision = 0,
  viewerRole,
}: {
  calendar?: CalendarApi
  conversations?: Conversation[]
  revision?: number
  viewerRole?: 'admin' | 'agent'
} = {}) {
  const [status, setStatus] = useState<Awaited<
    ReturnType<CalendarApi['status']>
  > | null>(null)
  const [edit, setEdit] = useState<BookingEdit | null>(null)
  const [notice, setNotice] = useState('')
  const [changed, setChanged] = useState(0)
  const [bookings, setBookings] = useState<BookingRecord[] | null>(null)
  const [dayCounts, setDayCounts] = useState<{
    key: string
    records: BookingRecord[]
    counts: Record<string, number> | null
  } | null>(null)
  const [selected, setSelected] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date())
  const today = new Date()
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const dates = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        month.getFullYear(),
        month.getMonth(),
        index - first.getDay() + 1,
        12
      )
  )
  const rangeStart = dateKey(dates[0])
  const rangeEnd = dateKey(dates[41])
  const rangeKey = rangeStart + '/' + rangeEnd
  const currentCounts =
    bookings !== null &&
    dayCounts?.key === rangeKey &&
    dayCounts.records === bookings
      ? dayCounts
      : null
  useEffect(() => {
    if (!calendar || bookings === null) return
    let live = true
    void calendar
      .counts(rangeStart, rangeEnd)
      .then((result) => {
        if (live)
          setDayCounts({
            key: rangeKey,
            records: bookings,
            counts: Object.fromEntries(
              result.counts.map((row) => [row.date, row.count])
            ),
          })
      })
      .catch(() => {
        if (live)
          setDayCounts({ key: rangeKey, records: bookings, counts: null })
      })
    return () => {
      live = false
    }
  }, [calendar, bookings, rangeStart, rangeEnd, rangeKey])
  function changeMonth(offset: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12))
  }
  function selectDate(date: Date) {
    setSelected(date)
    setMonth(date)
  }
  return (
    <section
      className='module-page booking-page'
      aria-labelledby='booking-title'
    >
      <div className='page-eyebrow'>預約管理</div>
      <h2 id='booking-title'>預約行事曆</h2>
      <p className='page-description'>
        {calendar
          ? '查看與管理預約。'
          : '查看日期與預約；Google 行事曆功能待串接。'}
      </p>
      {calendar && (
        <CalendarManager
          api={calendar}
          onRecords={setBookings}
          onStatus={setStatus}
          viewerRole={viewerRole}
          revision={revision + changed}
        />
      )}
      {!calendar && (
        <div className='surface booking-connection'>
          <div>
            <h3>
              <Link2 size={18} aria-hidden='true' />
              Google Calendar
            </h3>
            <p id='booking-connection-note'>
              尚未串接，無法讀取空檔或建立預約。
            </p>
          </div>
          <button
            className='primary-button'
            disabled
            aria-describedby='booking-connection-note'
          >
            連接 Google（待開放）
          </button>
        </div>
      )}
      <div className='booking-layout'>
        <div className='surface booking-month'>
          <div className='booking-toolbar'>
            <h3 aria-live='polite'>{monthLabel(month)}</h3>
            <div className='booking-month-actions'>
              <button
                className='small-button'
                onClick={() => selectDate(new Date())}
              >
                今天
              </button>
              <button
                className='icon-button'
                aria-label='上一個月'
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                className='icon-button'
                aria-label='下一個月'
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <p className='surface-note'>
            {calendar
              ? '日期下方顯示已確認預約筆數（不含已取消與待確認），不代表可預約空檔。'
              : '僅供日期瀏覽，不代表可預約時段。'}
          </p>
          {calendar && !currentCounts && (
            <p className='surface-note' role='status'>
              預約筆數尚未載入，空白不代表零筆。
            </p>
          )}
          {calendar && currentCounts?.counts === null && (
            <p role='alert'>
              預約筆數讀取失敗，請同步並重新整理；不以部分紀錄估算總數。
            </p>
          )}
          <table
            className='booking-grid'
            aria-label={monthLabel(month) + '日期瀏覽'}
          >
            <thead>
              <tr>
                {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                  <th scope='col' key={day}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, week) => (
                <tr key={week}>
                  {dates.slice(week * 7, week * 7 + 7).map((date) => (
                    <td key={date.getTime()}>
                      <button
                        className={
                          'booking-day' +
                          (date.getMonth() !== month.getMonth()
                            ? ' booking-outside'
                            : '')
                        }
                        aria-label={
                          dateLabel(date) +
                          (currentCounts?.counts
                            ? '，' +
                              (currentCounts.counts[dateKey(date)] ?? 0) +
                              ' 筆預約'
                            : '')
                        }
                        aria-pressed={sameDay(date, selected)}
                        aria-current={sameDay(date, today) ? 'date' : undefined}
                        onClick={() => selectDate(date)}
                      >
                        <span>{date.getDate()}</span>
                        {(currentCounts?.counts?.[dateKey(date)] ?? 0) > 0 && (
                          <span
                            className='booking-day-count'
                            aria-hidden='true'
                          >
                            {currentCounts!.counts![dateKey(date)]}
                          </span>
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className='surface-note booking-timezone'>
            {calendar
              ? '筆數依每筆預約保存的店家時區歸日，不受此裝置時區影響；同步失敗時仍可能是舊紀錄。'
              : '日期依此裝置時區顯示；預約時區尚未設定。'}
          </p>
        </div>
        <div className='booking-detail-column'>
          <div className='surface booking-day-detail' aria-live='polite'>
            <h3>{dateLabel(selected)}</h3>
            {notice && <p role='status'>{notice}</p>}
            {calendar && status?.canBook && !edit && (
              <button
                className='primary-button'
                onClick={() =>
                  setEdit({ kind: 'create', day: dateKey(selected) })
                }
              >
                新增預約
              </button>
            )}
            {calendar && edit && (
              <StaffBookingEditor
                api={calendar}
                edit={edit}
                service={status?.service ?? null}
                conversations={conversations}
                onClose={() => setEdit(null)}
                onChanged={(message) => {
                  setNotice(message)
                  setEdit(null)
                  setChanged((v) => v + 1)
                }}
              />
            )}
            {bookings === null ? (
              <div className='booking-empty'>
                <CalendarDays size={32} aria-hidden='true' />
                <strong>預約資料尚未載入</strong>
                <p>尚未取得預約紀錄，請重新讀取後再確認當天是否有預約。</p>
              </div>
            ) : (
              <BookingRows
                customerName={(row) =>
                  row.customerName ??
                  conversations.find((c) => c.id === row.conversationId)
                    ?.customerName
                }
                actions={(row) =>
                  status?.canBook &&
                  row.status === 'confirmed' &&
                  row.updatedAt &&
                  !edit && (
                    <div className='booking-month-actions'>
                      <button
                        className='small-button'
                        onClick={() => setEdit({ kind: 'move', booking: row })}
                      >
                        調整時間
                      </button>
                      <button
                        className='small-button'
                        onClick={() =>
                          setEdit({ kind: 'cancel', booking: row })
                        }
                      >
                        取消預約
                      </button>
                    </div>
                  )
                }
                rows={bookings.filter(
                  (r) =>
                    new Intl.DateTimeFormat('en-CA', {
                      timeZone: r.timeZone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date(r.start)) ===
                    new Intl.DateTimeFormat('en-CA', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(selected)
                )}
              />
            )}
          </div>
          {!calendar && (
            <div className='surface booking-setup'>
              <h3>日曆設定</h3>
              <dl>
                <div>
                  <dt>目標日曆</dt>
                  <dd>待連接</dd>
                </div>
                <div>
                  <dt>營業時段</dt>
                  <dd>待設定</dd>
                </div>
                <div>
                  <dt>預約長度</dt>
                  <dd>待設定</dd>
                </div>
              </dl>
              <details>
                <summary>設定前須知</summary>
                <p>
                  使用自己的 Google Cloud 專案。先將 OAuth 設為 In
                  production，再完成授權；曾在 Testing
                  授權者須重新連接並驗證，避免固定七天失效。
                </p>
                <a
                  href='https://github.com/JasperYang0609/ansai-line-admin/blob/main/INSTALL.md'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  查看安裝與授權指南（另開視窗）
                </a>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
