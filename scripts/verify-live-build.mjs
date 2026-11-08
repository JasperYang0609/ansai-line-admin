import { loadEnv } from 'vite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 正式部署必須明確宣告連線；一般課堂的示範建置仍可獨立使用。
export function checkLiveConfig(env) {
  if (env.VITE_HELPDESK_MODE !== 'live')
    throw new Error('正式建置必須設定正式登入模式，停止部署。')
  const base = new URL(env.VITE_SUPABASE_URL)
  const api = new URL(env.VITE_ADMIN_API_URL)
  if (
    base.protocol !== 'https:' ||
    api.origin !== base.origin ||
    !/^\/functions\/v1\/[^/]+\/?$/.test(api.pathname) ||
    /webhook/i.test(api.pathname)
  )
    throw new Error('正式管理入口與資料庫連線不符，停止部署。')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  let anon = false
  try {
    anon =
      JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'
  } catch {
    // 新式公開金鑰沒有登入權杖格式，改由公開金鑰前綴辨識。
  }
  if (!key.startsWith('sb_publishable_') && !anon)
    throw new Error('缺少可用的公開連線金鑰；不可使用管理秘密。')
}

export function checkLiveArtifact(text, env) {
  checkLiveConfig(env)
  // 核對預設 adapter 設定，不能只因程式內含「正式」字樣就算通過。
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    'mode\\s*:\\s*([`"\'])live\\1\\s*,\\s*apiUrl\\s*:\\s*([`"\'])' +
      escape(env.VITE_ADMIN_API_URL) +
      '\\2'
  )
  if (
    !pattern.test(text) ||
    !text.includes(env.VITE_SUPABASE_URL) ||
    !text.includes(env.VITE_SUPABASE_PUBLISHABLE_KEY)
  )
    throw new Error('產物未帶入核准的正式連線，停止部署。')
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const env = { ...loadEnv('production', process.cwd(), 'VITE_') }
    checkLiveConfig(env)
    if (process.argv.includes('--artifact')) {
      const text = readdirSync('dist/assets')
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFileSync('dist/assets/' + name, 'utf8'))
        .join('\n')
      checkLiveArtifact(text, env)
    }
    console.log('正式登入與安賽管理連線核對通過。')
  } catch (error) {
    console.error('正式建置檢查失敗：' + error.message)
    process.exitCode = 1
  }
}
