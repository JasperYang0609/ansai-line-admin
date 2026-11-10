import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import type { CalendarApi } from '../calendar-client'
import { CalendarManager, BookingEligibility } from './calendar-manager'

const settings = {
  calendarId: 'synthetic',
  service: '合成服務',
  rules: {
    timeZone: 'Asia/Taipei',
    weekdays: [1, 2, 3, 4, 5],
    opens: '10:00',
    closes: '18:00',
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    excludedDates: [],
  },
  eligibility: 'approval' as const,
  enabled: false,
  version: 2,
}
function api(): CalendarApi {
  return {
    status: vi.fn(async () => ({ state: 'connected' as const, isOwner: true })),
    settings: vi.fn(async () => ({ settings })),
    bookings: vi.fn(async () => ({ bookings: [] })),
    calendars: vi.fn(async () => ({
      calendars: [
        {
          id: 'synthetic',
          name: '合成測試日曆',
          timeZone: 'Asia/Taipei',
          writable: true,
        },
      ],
    })),
    connect: vi.fn(async () => ''),
    save: vi.fn(async () => ({ version: 3 })),
    reconcile: vi.fn(async () => ({ status: 'confirmed' as const })),
    approve: vi.fn(async () => ({ approved: true as const })),
  }
}
it('後端未讀取成功時保留錯誤，不把失敗當作沒有預約', async () => {
  const a = api()
  a.status = async () => {
    throw Error('合成中斷')
  }
  const records = vi.fn()
  await render(<CalendarManager api={a} onRecords={records} />)
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('日曆資料尚未讀取成功')
  expect(records).not.toHaveBeenCalled()
  expect(a.save).not.toHaveBeenCalled()
})
it('實際設定載入後才顯示可寫入日曆，保存使用既有版本，不偷偷啟用', async () => {
  const a = api()
  await render(<CalendarManager api={a} onRecords={() => {}} />)
  await expect
    .element(page.getByLabelText('預約服務名稱'))
    .toHaveValue('合成服務')
  await expect
    .element(page.getByLabelText('開放這項服務的自動預約'))
    .not.toBeChecked()
  await page.getByRole('button', { name: '保存預約設定' }).click()
  await expect.element(page.getByText('預約設定已保存。')).toBeVisible()
  expect(a.save).toHaveBeenCalledWith(settings)
})
it('核准資格必須明確點擊，沿用指定客戶與目前服務版本', async () => {
  const a = api()
  await render(
    <BookingEligibility api={a} conversationId='synthetic-customer' />
  )
  await expect
    .element(page.getByRole('button', { name: '確認資格並允許預約' }))
    .toBeVisible()
  expect(a.approve).not.toHaveBeenCalled()
  await page.getByRole('button', { name: '確認資格並允許預約' }).click()
  await expect
    .element(page.getByText('已核准這位客戶預約目前服務。'))
    .toBeVisible()
  expect(a.approve).toHaveBeenCalledWith('synthetic-customer', 2)
})
