import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  prepareCalendarSite,
  validateSiteConfig,
} from './prepare-calendar-site.mjs'

const config = {
  appName: '範例小店預約',
  operatorName: '範例小店',
  contactEmail: 'owner@example.test',
  aiProvider: '店家指定的模型供應商',
  policyDate: '2026-11-10',
  siteId: 'sample-shop-calendar',
  projectId: 'sample-shop-project',
}
test('靜態頁｜三頁獨立、政策可直接讀取、沒有登入或腳本；輸出不包含設定檔', async () => {
  const dir = `output/calendar-test-${randomUUID()}`
  const result = await prepareCalendarSite(config, dir)
  assert.equal(result.deployed, false)
  assert.equal(result.urls[1], 'https://sample-shop-calendar.web.app/privacy/')
  const home = await readFile(`${dir}/public/index.html`, 'utf8')
  const privacy = await readFile(`${dir}/public/privacy/index.html`, 'utf8')
  const terms = await readFile(`${dir}/public/terms/index.html`, 'utf8')
  assert(home.includes('href="/privacy/"'))
  assert(privacy.includes('Supabase 後端加密保存'))
  assert(privacy.includes('AI 模型供應商'))
  assert(privacy.includes('刪除本服務保存'))
  assert.notEqual(home, privacy)
  assert.notEqual(privacy, terms)
  for (const source of [home, privacy, terms])
    assert(
      !/\{\{|<script|<form|localStorage|client_secret|refresh_token/.test(
        source
      )
    )
  const firebase = JSON.parse(await readFile(`${dir}/firebase.json`, 'utf8'))
  assert.equal(firebase.hosting.site, config.siteId)
  assert.equal(firebase.hosting.rewrites, undefined)
  assert.equal(firebase.hosting.public, 'public')
  await assert.rejects(prepareCalendarSite(config, dir), /EEXIST/)
  assert.equal(
    await readFile(`${dir}/public/privacy/index.html`, 'utf8'),
    privacy
  )
})
test('靜態頁｜拒絕秘密欄位、錯誤網站識別碼及覆蓋專案目錄', async () => {
  assert.throws(() =>
    validateSiteConfig({ ...config, clientSecret: '合成秘密' })
  )
  assert.throws(() => validateSiteConfig({ ...config, siteId: '../其他網站' }))
  assert.throws(() =>
    validateSiteConfig({ ...config, contactEmail: '錯誤信箱' })
  )
  assert.throws(() =>
    validateSiteConfig({ ...config, policyDate: '2026-02-30' })
  )
  await assert.rejects(prepareCalendarSite(config, '.'), /僅允許/)
})
test('靜態頁｜店名當成文字跳脫，不把輸入變成網頁程式', async () => {
  const dir = `output/calendar-test-${randomUUID()}`
  await prepareCalendarSite(
    { ...config, appName: '<img src=x onerror=alert(1)>' },
    dir
  )
  const home = await readFile(`${dir}/public/index.html`, 'utf8')
  assert(home.includes('&lt;img'))
  assert(!home.includes('<img'))
})
