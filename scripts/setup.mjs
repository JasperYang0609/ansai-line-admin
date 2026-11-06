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

export function readModes(source) {
  const modes = []
  for (const line of source.split(/\r?\n/)) {
    if (!/^\s*(?:export\s+)?VITE_HELPDESK_MODE\b/.test(line)) continue
    const match = line.match(
      /^\s*(?:export\s+)?VITE_HELPDESK_MODE\s*=\s*(?:([a-z]+)|'([a-z]+)'|"([a-z]+)")\s*(?:#.*)?$/
    )
    const mode = match?.[1] ?? match?.[2] ?? match?.[3]
    if (mode !== 'demo' && mode !== 'live')
      throw new Error(
        '不明模式設定；只接受 literal demo／live，保留原檔並停止。'
      )
    modes.push(mode)
  }
  return modes
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
  const modes = new Set()
  if (env.VITE_HELPDESK_MODE !== undefined) {
    if (!['demo', 'live'].includes(env.VITE_HELPDESK_MODE))
      throw new Error('不明環境模式；保留原設定並停止。')
    modes.add(env.VITE_HELPDESK_MODE)
  }
  for (const file of envFiles) {
    if (existsSync(resolve(root, file)))
      for (const mode of readModes(readFileSync(resolve(root, file), 'utf8')))
        modes.add(mode)
  }
  // Report declarations, not an effective-mode or connectivity claim: Vite applies
  // different precedence for dev/build. Never rewrite either environment.
  const mode = modes.size > 1 ? 'mixed' : ([...modes][0] ?? 'demo')
  const summary = { commit, node: nodeVersion, pnpm, mode, dirty }
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
    '安裝與建置成功。下一步：pnpm dev --host 127.0.0.1；請依既有環境驗證登入與 API，建置成功不代表 LINE 已接通。'
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
