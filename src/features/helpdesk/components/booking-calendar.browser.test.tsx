import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { createDemoApi } from '../api'
import { HelpdeskApp } from '../app'
import '../app.css'
import { BookingCalendarPage } from './booking-calendar'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('shows a real leap-year month, changes months across years, selects dates and returns to today', async () => {
  vi.setSystemTime(new Date(2024, 1, 15, 12))
  await render(<BookingCalendarPage />)
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2024年2月日期瀏覽')
  expect(document.querySelectorAll('.booking-day')).toHaveLength(42)
  await page.getByRole('button', { name: /2024年2月29日/ }).click()
  await expect
    .element(page.getByRole('button', { name: /2024年2月29日/ }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect
    .element(page.getByRole('heading', { name: /2024年2月29日/ }))
    .toBeVisible()
  await page.getByRole('button', { name: '上一個月' }).click()
  await page.getByRole('button', { name: '上一個月' }).click()
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2023年12月日期瀏覽')
  await page.getByRole('button', { name: '下一個月' }).click()
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2024年1月日期瀏覽')
  await page.getByRole('button', { name: '今天', exact: true }).click()
  await expect
    .element(page.getByRole('button', { name: /2024年2月15日/ }))
    .toHaveAttribute('aria-current', 'date')
  await expect
    .element(page.getByRole('button', { name: /2024年2月15日/ }))
    .toHaveAttribute('aria-pressed', 'true')
})

it('has no fake appointments, connection success, API requests or persistent settings', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  await render(<BookingCalendarPage />)
  await expect
    .element(page.getByRole('button', { name: '連接 Google（待開放）' }))
    .toBeDisabled()
  await expect
    .element(page.getByText('預約資料尚未載入', { exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByText('僅供日期瀏覽，不代表可預約時段。'))
    .toBeVisible()
  await page.getByRole('button', { name: '下一個月' }).click()
  await page.getByText('設定前須知', { exact: true }).click()
  await expect
    .element(page.getByRole('link', { name: /查看安裝與授權指南/ }))
    .toHaveAttribute('rel', 'noopener noreferrer')
  expect(fetch).not.toHaveBeenCalled()
  expect(storage).not.toHaveBeenCalled()
})

it('opens from the sidebar, preserves the inbox draft and does not send or switch AI mode', async () => {
  await page.viewport(1440, 900)
  const api = createDemoApi()
  const send = vi.spyOn(api, 'sendMessage')
  const mode = vi.spyOn(api, 'setMode')
  await render(<HelpdeskApp api={api} />)
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  const calls = mode.mock.calls.length
  await page.getByRole('textbox', { name: /回覆訊息/ }).fill('尚未送出的草稿')
  await page.getByRole('button', { name: '預約行事曆', exact: true }).click()
  await expect
    .element(page.getByRole('heading', { name: '預約行事曆', exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole('button', { name: '預約行事曆', exact: true }))
    .toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: /^收件匣/ }).click()
  await expect
    .element(page.getByRole('textbox', { name: /回覆訊息/ }))
    .toHaveValue('尚未送出的草稿')
  expect(send).not.toHaveBeenCalled()
  expect(mode.mock.calls).toHaveLength(calls)
})
