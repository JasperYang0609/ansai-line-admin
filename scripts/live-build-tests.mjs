import assert from 'node:assert/strict'
import test from 'node:test'
import { checkLiveArtifact, checkLiveConfig } from './verify-live-build.mjs'

const env = {
  VITE_HELPDESK_MODE: 'live',
  VITE_SUPABASE_URL: 'https://synthetic.supabase.co',
  VITE_ADMIN_API_URL: 'https://synthetic.supabase.co/functions/v1/line-admin',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
}
test('缺少正式設定、示範模式及錯誤管理入口都不能發布', () => {
  assert.throws(() => checkLiveConfig({}))
  assert.throws(() => checkLiveConfig({ ...env, VITE_HELPDESK_MODE: 'demo' }))
  assert.throws(() =>
    checkLiveConfig({ ...env, VITE_ADMIN_API_URL: 'https://other.invalid/api' })
  )
  assert.throws(() =>
    checkLiveConfig({
      ...env,
      VITE_ADMIN_API_URL:
        'https://synthetic.supabase.co/functions/v1/line-webhook',
    })
  )
  checkLiveConfig(env)
})
test('產物必須使用正式預設 adapter，支援壓縮器引號差異', () => {
  for (const quote of ['"', "'", '`']) {
    const text = `mode:${quote}live${quote},apiUrl:${quote}${env.VITE_ADMIN_API_URL}${quote};${env.VITE_SUPABASE_URL};${env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    checkLiveArtifact(text, env)
    assert.throws(() => checkLiveArtifact(text.replace('live', 'demo'), env))
  }
})
