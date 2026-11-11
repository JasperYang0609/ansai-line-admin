import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fields = [
  'appName',
  'operatorName',
  'contactEmail',
  'aiProvider',
  'policyDate',
  'siteId',
  'projectId',
]
const files = [
  'index.html',
  'privacy/index.html',
  'terms/index.html',
  '404.html',
  'style.css',
]
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  )

export function validateSiteConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    Object.keys(config).some((k) => !fields.includes(k)) ||
    fields.some(
      (k) =>
        typeof config[k] !== 'string' ||
        !config[k].trim() ||
        config[k].length > 160
    )
  )
    throw Error('網站設定缺項或含未允許欄位；不接受憑證。')
  const value = Object.fromEntries(fields.map((k) => [k, config[k].trim()]))
  if (
    !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.projectId) ||
    !/^[a-z0-9][a-z0-9-]{2,28}[a-z0-9]$/.test(value.siteId) ||
    !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.contactEmail)
  )
    throw Error('專案、網站識別碼或聯絡信箱無效。')
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.policyDate) ||
    !Number.isFinite(Date.parse(value.policyDate)) ||
    new Date(value.policyDate).toISOString().slice(0, 10) !== value.policyDate
  )
    throw Error('政策日期無效。')
  if (
    Object.values(value).some((s) =>
      /\{\{|請填|YOUR_|REPLACE_|client_secret|refresh_token|sb_secret_|AIza[\w-]{20}/i.test(
        s
      )
    )
  )
    throw Error('須填寫自己的公開資料，且不得包含秘密或未替換標記。')
  return value
}

export async function prepareCalendarSite(config, directory) {
  const c = validateSiteConfig(config)
  const output = resolve(directory)
  if (output === root || !output.startsWith(join(root, 'output') + '/'))
    throw Error('僅允許輸出到本專案 output 下的新資料夾。')
  // 也拒絕連到其他位置的目錄，避免透過符號連結誤寫既有網站。
  for (let p = output; p !== root; p = dirname(p)) {
    try {
      if ((await lstat(p)).isSymbolicLink())
        throw Error('輸出路徑不可包含符號連結。')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  const origin = `https://${c.siteId}.web.app`
  const values = {
    APP_NAME: c.appName,
    OPERATOR_NAME: c.operatorName,
    CONTACT_EMAIL: c.contactEmail,
    AI_PROVIDER: c.aiProvider,
    POLICY_DATE: c.policyDate,
  }
  const rendered = await Promise.all(
    files.map(async (file) => {
      let source = await readFile(
        join(root, 'templates/calendar-public-site', file),
        'utf8'
      )
      source = source.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
        if (!(key in values)) throw Error('模板含未知欄位。')
        return escape(values[key])
      })
      if (/\{\{|<script|<iframe|<form|localStorage|sessionStorage/.test(source))
        throw Error('公開頁面不得包含腳本、登入或未替換欄位。')
      return [file, source]
    })
  )
  await mkdir(dirname(output), { recursive: true })
  // 新目錄專用；重跑須換新名稱，不覆蓋既有網站或 Firebase 設定。
  await mkdir(output)
  for (const [file, source] of rendered) {
    const target = join(output, 'public', file)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, source, { flag: 'wx' })
  }
  const firebase = {
    hosting: {
      site: c.siteId,
      public: 'public',
      ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
      headers: [
        {
          source: '**',
          headers: [
            {
              key: 'Content-Security-Policy',
              value:
                "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            },
            { key: 'Referrer-Policy', value: 'no-referrer' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
          ],
        },
      ],
    },
  }
  await writeFile(
    join(output, 'firebase.json'),
    JSON.stringify(firebase, null, 2) + '\n',
    { flag: 'wx' }
  )
  await writeFile(
    join(output, '.firebaserc'),
    JSON.stringify({ projects: { default: c.projectId } }, null, 2) + '\n',
    { flag: 'wx' }
  )
  return {
    output,
    urls: [origin + '/', origin + '/privacy/', origin + '/terms/'],
    deployed: false,
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2)
  try {
    if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--out')
      throw Error(
        '使用方式：提供 --config 公開資料設定檔及 --out output 下的新目錄。'
      )
    const config = JSON.parse(await readFile(resolve(args[1]), 'utf8'))
    console.log(JSON.stringify(await prepareCalendarSite(config, args[3])))
  } catch {
    console.error(
      '靜態頁準備失敗：請核對公開設定、模板及新輸出目錄；不覆寫、不部署、不顯示設定值。'
    )
    process.exitCode = 1
  }
}
