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
    changeBooking: vi.fn(async () => ({
      bookingId: '合成預約',
      status: 'confirmed' as const,
    })),
    connect: vi.fn(async () => ''),
    save: vi.fn(async () => ({ version: 3 })),
    counts: vi.fn(async () => ({ counts: [] })),
    sync: vi.fn(async () => ({
      checked: 1,
      updated: 0,
      cancelled: 0,
      conflicts: 0,
      failed: 0,
      remaining: 0,
    })),
    pause: vi.fn(async () => ({ enabled: false as const })),
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

it('暫停必須明確點擊，呼叫後端停用而非只改前端畫面', async () => {
  const a = api()
  await render(<CalendarManager api={a} onRecords={() => {}} />)
  await expect
    .element(page.getByRole('button', { name: '暫停自動預約' }))
    .toBeVisible()
  expect(a.pause).not.toHaveBeenCalled()
  await page.getByRole('button', { name: '暫停自動預約' }).click()
  await expect.poll(() => a.pause).toHaveBeenCalledTimes(1)
})

it('明確重新整理先同步 Google 再讀紀錄，不在初次載入時修改資料', async () => {
  const a = api()
  const order: string[] = []
  a.sync = vi.fn(async () => {
    order.push('sync')
    return {
      checked: 1,
      updated: 0,
      cancelled: 1,
      conflicts: 0,
      failed: 0,
      remaining: 0,
    }
  })
  a.bookings = vi.fn(async () => {
    order.push('bookings')
    return { bookings: [] }
  })
  await render(<CalendarManager api={a} onRecords={() => {}} />)
  await expect
    .element(page.getByLabelText('預約服務名稱'))
    .toHaveValue('合成服務')
  expect(a.sync).not.toHaveBeenCalled()
  order.length = 0
  await page.getByRole('button', { name: '同步 Google 並重新整理' }).click()
  await expect.element(page.getByText(/本批 Google 同步完成/)).toBeVisible()
  expect(order).toEqual(['sync', 'bookings'])
})

it('部分失敗與待同步明確顯示，不宣稱全數最新', async () => {
  const a = api()
  a.sync = vi.fn(async () => ({
    checked: 2,
    updated: 0,
    cancelled: 0,
    conflicts: 1,
    failed: 1,
    remaining: 3,
  }))
  await render(<CalendarManager api={a} onRecords={() => {}} />)
  await expect
    .element(page.getByLabelText('預約服務名稱'))
    .toHaveValue('合成服務')
  await page.getByRole('button', { name: '同步 Google 並重新整理' }).click()
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('Google 同步尚未全部完成')
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('1 筆時段衝突')
  await expect
    .element(page.getByText(/本批 Google 同步完成/))
    .not.toBeInTheDocument()
})

it('同步失敗不以零筆或舊紀錄冒充成功，且允許再嘗試', async () => {
  const a = api(),
    records = vi.fn()
  a.sync = vi.fn(async () => {
    throw Error('合成授權失效')
  })
  await render(<CalendarManager api={a} onRecords={records} />)
  await expect
    .element(page.getByLabelText('預約服務名稱'))
    .toHaveValue('合成服務')
  records.mockClear()
  await page.getByRole('button', { name: '同步 Google 並重新整理' }).click()
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('Google 同步未完成')
  expect(records).not.toHaveBeenCalled()
  await expect
    .element(page.getByRole('button', { name: '同步 Google 並重新整理' }))
    .toBeEnabled()
})

it('初次載入的舊回應不覆蓋使用者較新的同步結果', async () => {
  const a = api(),
    records = vi.fn()
  let finish!: (value: Awaited<ReturnType<CalendarApi['bookings']>>) => void
  const initial = new Promise<Awaited<ReturnType<CalendarApi['bookings']>>>(
    (resolve) => {
      finish = resolve
    }
  )
  a.bookings = vi
    .fn()
    .mockReturnValueOnce(initial)
    .mockResolvedValue({ bookings: [] })
  await render(<CalendarManager api={a} onRecords={records} />)
  await expect.poll(() => a.bookings).toHaveBeenCalledTimes(1)
  await page.getByRole('button', { name: '同步 Google 並重新整理' }).click()
  await expect.element(page.getByText(/本批 Google 同步完成/)).toBeVisible()
  finish({
    bookings: [
      {
        id: 'stale',
        conversationId: 'synthetic',
        eventId: 'synthetic',
        start: '2026-11-11T02:00:00Z',
        end: '2026-11-11T03:00:00Z',
        status: 'confirmed',
        service: '不該回填的舊預約',
        timeZone: 'Asia/Taipei',
      },
    ],
  })
  await initial
  await new Promise((resolve) => requestAnimationFrame(resolve))
  expect(records).toHaveBeenCalledTimes(1)
  expect(records).toHaveBeenLastCalledWith([])
})
