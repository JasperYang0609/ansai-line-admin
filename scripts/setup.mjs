import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
]

export function assertDemo(source) {
  for (const line of source.split(/\r?\n/)) {
    if (!/^\s*(?:export\s+)?VITE_HELPDESK_MODE\b/.test(line)) continue
    if (
      !/^\s*(?:export\s+)?VITE_HELPDESK_MODE\s*=\s*(?:demo|'demo'|"demo")\s*(?:#.*)?$/.test(
        line
      )
    ) {
      throw new Error(
        '偵測到非 demo 或不明模式設定；保留原檔，請先由使用者確認。'
      )
    }
  }
}

function execute(command, args, { cwd, inherit = false }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    shell: false,
  })
  if (result.error || result.status !== 0) {
    throw new Error(
      command + ' ' + args.join(' ') + ' 失敗；停止，不自動重試或更換安裝方式。'
    )
  }
  return (result.stdout ?? '').trim()
}

export function runSetup({
  root = projectRoot,
  cwd = process.cwd(),
  nodeVersion = process.versions.node,
  platform = process.platform,
  env = process.env,
  check = false,
  run = execute,
  log = console.log,
} = {}) {
  if (platform === 'win32')
    throw new Error('請在 WSL 執行；原生 Windows 尚未驗收。')
  if (!/^24\./.test(nodeVersion))
    throw new Error('需要 Node.js 24 LTS；請先確認工具版本，不修改全機設定。')
  if (realpathSync(root) !== realpathSync(cwd))
    throw new Error('請在 ansai-line-admin 專案根目錄執行。')
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  if (
    pkg.name !== 'ansai-line-admin' ||
    pkg.packageManager !== 'pnpm@11.24.0'
  ) {
    throw new Error('專案識別或套件管理器不符；請核對官方 INSTALL.md。')
  }
  for (const file of [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'AGENTS.md',
    'INSTALL.md',
    'LICENSE',
    'NOTICE',
    'src/features/helpdesk/api.ts',
  ]) {
    if (!existsSync(resolve(root, file)))
      throw new Error('專案檔案不完整；請核對官方來源，不自動補造檔案。')
  }
  const gitRoot = run('git', ['rev-parse', '--show-toplevel'], { cwd: root })
  if (realpathSync(gitRoot) !== realpathSync(root))
    throw new Error('不是獨立的安賽專案 Git 根目錄。')
  const commit = run('git', ['rev-parse', 'HEAD'], { cwd: root })
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error('無法確認完整 Git commit。')
  const dirty = Boolean(run('git', ['status', '--porcelain'], { cwd: root }))
  const pnpm = run('pnpm', ['--version'], { cwd: root })
  if (pnpm !== '11.24.0')
    throw new Error('需要 pnpm 11.24.0；保留 lockfile，不改用 npm/yarn。')
  if (
    env.VITE_HELPDESK_MODE !== undefined &&
    env.VITE_HELPDESK_MODE !== 'demo'
  ) {
    throw new Error(
      '環境模式不是 demo；請先由使用者確認，安裝不會改動既有設定。'
    )
  }
  for (const file of envFiles) {
    if (existsSync(resolve(root, file)))
      assertDemo(readFileSync(resolve(root, file), 'utf8'))
  }
  const summary = { commit, node: nodeVersion, pnpm, mode: 'demo', dirty }
  log('安裝檢查通過 ' + JSON.stringify(summary))
  if (check) {
    log('僅檢查：未安裝套件、未建置、未改設定。')
    return summary
  }
  const lockBefore = readFileSync(resolve(root, 'pnpm-lock.yaml'))
  run('pnpm', ['install', '--frozen-lockfile'], { cwd: root, inherit: true })
  if (!lockBefore.equals(readFileSync(resolve(root, 'pnpm-lock.yaml')))) {
    throw new Error('安裝後 lockfile 發生變動；停止並保留現場，不繼續 build。')
  }
  run('pnpm', ['build'], { cwd: root, inherit: true })
  log(
    '安裝與建置成功。下一步：pnpm dev --host 127.0.0.1；僅示範，尚未接 LINE。'
  )
  return summary
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const args = process.argv.slice(2)
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
      throw new Error('用法：node scripts/setup.mjs [--check]')
    runSetup({ check: args[0] === '--check' })
  } catch (error) {
    console.error(
      '安裝停止：' + (error instanceof Error ? error.message : '檢查失敗。')
    )
    process.exitCode = 1
  }
}
