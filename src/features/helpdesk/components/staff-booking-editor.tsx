import { useState } from 'react'
import type { BookingRecord, CalendarApi } from '../calendar-client'
import type { Conversation } from '../types'

export type BookingEdit =
  | { kind: 'create'; day: string }
  | { kind: 'move' | 'cancel'; booking: BookingRecord }

export function StaffBookingEditor({
  api,
  edit,
  service,
  conversations,
  onClose,
  onChanged,
}: {
  api: CalendarApi
  edit: BookingEdit
  service: { name: string; timeZone: string; durationMinutes: number } | null
  conversations: Conversation[]
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const record = edit.kind === 'create' ? null : edit.booking
  const [start, setStart] = useState(
    edit.kind === 'create' ? edit.day + 'T10:00' : ''
  )
  const [conversationId, setConversationId] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  async function save() {
    setSaving(true)
    setError('')
    try {
      const result = await api.changeBooking(
        edit.kind === 'create'
          ? {
              kind: 'create',
              requestId,
              start,
              conversationId: conversationId || undefined,
              customerName: conversationId ? undefined : name.trim(),
            }
          : {
              kind: edit.kind,
              requestId,
              bookingId: edit.booking.id,
              expectedUpdatedAt: edit.booking.updatedAt!,
              start,
            }
      )
      onChanged(
        result.status === 'unknown'
          ? '結果待核對，請從原紀錄核對，避免重複操作。'
          : result.status === 'cancelled'
            ? '預約已取消，原紀錄保留。'
            : edit.kind === 'move'
              ? '已更新預約時間。'
              : '已新增預約。'
      )
    } catch (reason) {
      const status =
        typeof reason === 'object' && reason && 'status' in reason
          ? reason.status
          : undefined
      if (status === 0 || status === 502 || status === 504) {
        onChanged('連線中斷，請先重新讀取原預約並核對結果。')
        return
      }
      setError(
        status === 409
          ? '預約或時段已變更。請關閉表單，重新整理並核對時段。'
          : status === 400
            ? '請確認姓名、預約日期、營業時段及 Google 日曆是否有其他行程。'
            : '這次沒有確認成功。請重新整理並核對原預約。'
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      className='booking-rule-grid'
      aria-label='人工預約操作'
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) void save()
      }}
    >
      <h4>
        {edit.kind === 'create'
          ? '新增預約'
          : edit.kind === 'move'
            ? '調整預約時間'
            : '取消預約'}
      </h4>
      {edit.kind === 'create' && (
        <>
          <label>
            連結客戶對話
            <select
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
            >
              <option value=''>不連結 LINE 對話</option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerName}
                </option>
              ))}
            </select>
          </label>
          {!conversationId && (
            <label>
              客戶姓名
              <input
                required
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {service && (
            <p>
              {service.name} · {service.durationMinutes} 分鐘
            </p>
          )}
        </>
      )}
      {edit.kind !== 'cancel' && (
        <label>
          預約開始時間（{record?.timeZone ?? service?.timeZone}）
          <input
            type='datetime-local'
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
      )}
      {edit.kind === 'cancel' && (
        <p>
          確認取消這筆「{record?.service}」預約？Google
          行程會移除，後台保留取消紀錄。
        </p>
      )}
      {error && <p role='alert'>{error}</p>}
      <div className='booking-month-actions'>
        <button className='primary-button' disabled={saving} type='submit'>
          {edit.kind === 'cancel' ? '確認取消' : '儲存預約'}
        </button>
        <button
          className='small-button'
          disabled={saving}
          type='button'
          onClick={onClose}
        >
          關閉
        </button>
      </div>
    </form>
  )
}
