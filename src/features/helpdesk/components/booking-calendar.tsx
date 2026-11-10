import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import './booking-calendar.css'

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
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** Presentation only: no OAuth, booking API, persistence or sample appointments. */
export function BookingCalendarPage() {
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
        查看日期與預約；Google 行事曆功能待串接。
      </p>
      <div className='surface booking-connection'>
        <div>
          <h3>
            <Link2 size={18} aria-hidden='true' />
            Google Calendar
          </h3>
          <p id='booking-connection-note'>尚未串接，無法讀取空檔或建立預約。</p>
        </div>
        <button
          className='primary-button'
          disabled
          aria-describedby='booking-connection-note'
        >
          連接 Google（待開放）
        </button>
      </div>
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
          <p className='surface-note'>僅供日期瀏覽，不代表可預約時段。</p>
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
                        aria-label={dateLabel(date)}
                        aria-pressed={sameDay(date, selected)}
                        aria-current={sameDay(date, today) ? 'date' : undefined}
                        onClick={() => selectDate(date)}
                      >
                        {date.getDate()}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className='surface-note booking-timezone'>
            日期依此裝置時區顯示；預約時區尚未設定。
          </p>
        </div>
        <div className='booking-detail-column'>
          <div className='surface booking-day-detail' aria-live='polite'>
            <h3>{dateLabel(selected)}</h3>
            <div className='booking-empty'>
              <CalendarDays size={32} aria-hidden='true' />
              <strong>預約資料尚未載入</strong>
              <p>
                完成日曆串接後，才能查看此日預約。此處空白不代表當天沒有預約。
              </p>
            </div>
          </div>
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
        </div>
      </div>
    </section>
  )
}
