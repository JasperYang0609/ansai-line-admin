import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readModes, runSetup } from './setup.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ansai-setup-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'src/features/helpdesk'), { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'ansai-line-admin', packageManager: 'pnpm@11.24.0' })
  )
  for (const file of [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'AGENTS.md',
    'INSTALL.md',
    'LICENSE',
    'NOTICE',
    'src/features/helpdesk/api.ts',
  ])
    writeFileSync(join(root, file), 'fixture')
  const calls = [],
    logs = []
  const run = (command, args, options) => {
    calls.push({ command, args, options })
    if (command === 'git' && args[1] === '--show-toplevel') return root
    if (command === 'git' && args[1] === 'HEAD') return 'a'.repeat(40)
    if (command === 'git') return ''
    if (args[0] === '--version') return '11.24.0'
    return ''
  }
  return {
    root,
    cwd: root,
    nodeVersion: '24.22.0',
    platform: 'linux',
    env: {},
    run,
    log: (s) => logs.push(s),
    calls,
    logs,
  }
}

test('check-only does not install/build, overwrite config or print private values', (t) => {
  const f = fixture(t)
  writeFileSync(
    join(f.root, '.env.local'),
    'VITE_HELPDESK_MODE=demo\nDO_NOT_PRINT=private-fixture\n'
  )
  const before = readFileSync(join(f.root, '.env.local'), 'utf8')
  assert.equal(runSetup({ ...f, check: true }).mode, 'demo')
  assert.deepEqual(
    f.calls.filter((c) => c.command === 'pnpm').map((c) => c.args),
    [['--version']]
  )
  assert.equal(readFileSync(join(f.root, '.env.local'), 'utf8'), before)
  assert.ok(!f.logs.join('').includes('private-fixture'))
})

test('install uses frozen lockfile then build and can be repeated', (t) => {
  const f = fixture(t)
  runSetup(f)
  runSetup(f)
  assert.deepEqual(
    f.calls.filter((c) => c.options.inherit).map((c) => [c.command, ...c.args]),
    [
      ['pnpm', 'install', '--frozen-lockfile'],
      ['pnpm', 'build'],
      ['pnpm', 'install', '--frozen-lockfile'],
      ['pnpm', 'build'],
    ]
  )
})

for (const version of ['22.23.1', '25.1.0', '240.0.0'])
  test('refuses unsupported Node ' + version, (t) => {
    const f = fixture(t)
    assert.throws(() => runSetup({ ...f, nodeVersion: version }), /Node.js 24/)
    assert.equal(f.calls.length, 0)
  })

test('refuses wrong directory and wrong project', (t) => {
  const f = fixture(t)
  assert.throws(() => runSetup({ ...f, cwd: tmpdir() }), /根目錄/)
  writeFileSync(
    join(f.root, 'package.json'),
    JSON.stringify({ name: 'shadcn-admin', packageManager: 'pnpm@11.24.0' })
  )
  assert.throws(() => runSetup(f), /專案識別/)
  assert.equal(f.calls.length, 0)
})

test('refuses wrong/missing pnpm and never substitutes npm', (t) => {
  const f = fixture(t)
  for (const version of ['10.0.0', '11.24.1'])
    assert.throws(
      () =>
        runSetup({
          ...f,
          run: (command, args, options) =>
            command === 'pnpm' ? version : f.run(command, args, options),
        }),
      /pnpm 11.24.0/
    )
  assert.throws(
    () =>
      runSetup({
        ...f,
        run: (command, args, options) => {
          if (command === 'pnpm') throw new Error('missing pnpm')
          return f.run(command, args, options)
        },
      }),
    /missing pnpm/
  )
  assert.ok(!f.calls.some((c) => c.command === 'npm'))
})

test('missing project file fails before installation', (t) => {
  const f = fixture(t)
  rmSync(join(f.root, 'pnpm-lock.yaml'))
  assert.throws(() => runSetup(f), /不完整/)
  assert.equal(f.calls.length, 0)
})

for (const file of [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
])
  test('existing live config is preserved and accepted: ' + file, (t) => {
    const f = fixture(t)
    writeFileSync(
      join(f.root, file),
      'VITE_HELPDESK_MODE=live\nTOKEN=private-fixture\n'
    )
    assert.equal(runSetup({ ...f, check: true }).mode, 'live')
    assert.ok(!f.calls.some((c) => c.options.inherit))
    assert.ok(readFileSync(join(f.root, file), 'utf8').includes('=live'))
    assert.ok(!f.logs.join('').includes('private-fixture'))
  })

test('inherited unknown mode fails closed', (t) => {
  const f = fixture(t)
  assert.throws(
    () => runSetup({ ...f, env: { VITE_HELPDESK_MODE: 'invalid' } }),
    /不明環境模式/
  )
  assert.ok(!f.calls.some((c) => c.options.inherit))
})

test('accepts only literal known modes, never evaluates env content', () => {
  for (const mode of [
    'demo',
    '"demo"',
    "'demo'",
    'demo # comment',
    'live',
    '"live"',
    "'live'",
  ])
    assert.doesNotThrow(() => readModes('export VITE_HELPDESK_MODE=' + mode))
  for (const mode of [
    'invalid',
    '',
    'DEMO',
    '$' + '{MODE}',
    '$(touch marker)',
    'demo;echo bad',
    '"demo" trailing',
  ])
    assert.throws(() => readModes('VITE_HELPDESK_MODE=' + mode), /不明模式/)
  assert.doesNotThrow(() => readModes('# VITE_HELPDESK_MODE=live\nOTHER=value'))
})

test('install failure stops without build or retry', (t) => {
  const f = fixture(t)
  assert.throws(
    () =>
      runSetup({
        ...f,
        run: (command, args, options) => {
          if (args[0] === 'install') {
            f.run(command, args, options)
            throw new Error('install failed')
          }
          return f.run(command, args, options)
        },
      }),
    /install failed/
  )
  assert.equal(f.calls.filter((c) => c.args[0] === 'install').length, 1)
  assert.ok(!f.calls.some((c) => c.args[0] === 'build'))
})

test('build failure never announces success', (t) => {
  const f = fixture(t)
  assert.throws(
    () =>
      runSetup({
        ...f,
        run: (command, args, options) => {
          if (args[0] === 'build') throw new Error('build failed')
          return f.run(command, args, options)
        },
      }),
    /build failed/
  )
  assert.ok(!f.logs.join('').includes('安裝與建置成功'))
})

test('unexpected lockfile change blocks build', (t) => {
  const f = fixture(t)
  assert.throws(
    () =>
      runSetup({
        ...f,
        run: (command, args, options) => {
          if (args[0] === 'install')
            writeFileSync(join(f.root, 'pnpm-lock.yaml'), 'changed')
          return f.run(command, args, options)
        },
      }),
    /lockfile 發生變動/
  )
  assert.ok(!f.calls.some((c) => c.args[0] === 'build'))
})

test('rejects nested Git root and native Windows', (t) => {
  const f = fixture(t)
  assert.throws(() => runSetup({ ...f, run: () => tmpdir() }), /Git 根目錄/)
  assert.throws(() => runSetup({ ...f, platform: 'win32' }), /WSL/)
})

test('inherited live installs/builds without downgrading or logging private values', (t) => {
  const f = fixture(t)
  const env = { VITE_HELPDESK_MODE: 'live', PRIVATE_TOKEN: 'private-fixture' }
  assert.equal(runSetup({ ...f, env }).mode, 'live')
  assert.equal(env.VITE_HELPDESK_MODE, 'live')
  assert.equal(f.calls.filter((c) => c.options.inherit).length, 2)
  assert.ok(!f.logs.join('').includes('private-fixture'))
  assert.ok(!f.logs.join('').includes('僅示範'))
})
test('mixed dev/build declarations are reported without rewriting either file', (t) => {
  const f = fixture(t)
  writeFileSync(join(f.root, '.env.development'), 'VITE_HELPDESK_MODE=demo\n')
  writeFileSync(join(f.root, '.env.production'), 'VITE_HELPDESK_MODE=live\n')
  assert.equal(runSetup({ ...f, check: true }).mode, 'mixed')
  assert.equal(
    readFileSync(join(f.root, '.env.production'), 'utf8'),
    'VITE_HELPDESK_MODE=live\n'
  )
})
test('unknown file mode stops before installing and does not disclose content', (t) => {
  const f = fixture(t)
  writeFileSync(
    join(f.root, '.env.production'),
    'VITE_HELPDESK_MODE=private-fixture\n'
  )
  assert.throws(() => runSetup(f), /不明模式/)
  assert.ok(!f.calls.some((c) => c.options.inherit))
  assert.ok(!f.logs.join('').includes('private-fixture'))
})
