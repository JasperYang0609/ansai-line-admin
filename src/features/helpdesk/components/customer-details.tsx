import { useCallback, useEffect, useRef, useState } from 'react'
import { codepoints, customerUpdateSchema } from '../customer'
import type { CustomerDetails, HelpdeskApi } from '../types'

export type CustomerGuard = { dirty: boolean; saving: boolean }
const statusOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : 0

export function CustomerDetailsPanel({
  api,
  conversationId,
  customerName,
  guardRef,
  onSaved,
  onUnauthorized,
}: {
  api: HelpdeskApi
  conversationId: string
  customerName: string
  guardRef: React.RefObject<CustomerGuard>
  onSaved: (details: CustomerDetails) => void
  onUnauthorized: (error: unknown) => void
}) {
  const [saved, setSaved] = useState<CustomerDetails | null>(null)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [blocked, setBlocked] = useState(false)
  const active = useRef(false)
  const request = useRef(0)
  const lock = useRef(false)
  const dirty =
    !!saved &&
    (note !== saved.note ||
      JSON.stringify(tags) !== JSON.stringify(saved.tags) ||
      !!tag)
  useEffect(() => {
    guardRef.current = { dirty, saving }
  }, [dirty, saving, guardRef])
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      guardRef.current = { dirty: false, saving: false }
    }
  }, [guardRef])
  const fail = useCallback(
    (reason: unknown) => {
      const status = statusOf(reason)
      if (status === 401) {
        onUnauthorized(reason)
        return
      }
      setBlocked(true)
      setError(
        [404, 405, 501].includes(status)
          ? '後端尚未提供客戶資料功能，需更新後端；未確認儲存。'
          : status === 403
            ? '沒有客戶資料編輯或查閱權限，請聯絡管理員。'
            : status === 409
              ? '其他人已更新客戶資料。草稿已保留，請先重新載入最新資料，不會自動覆寫。'
              : status === 503
                ? '客戶資料服務暫時不可用，已停止儲存。草稿已保留，請稍後重新載入確認。'
                : '未確認客戶資料是否儲存，草稿已保留。請重新載入確認，勿直接重試。'
      )
    },
    [onUnauthorized]
  )
  const load = useCallback(async () => {
    const generation = ++request.current
    try {
      const data = await api.getCustomer(conversationId)
      if (!active.current || generation !== request.current) return
      setSaved(data)
      setNote(data.note)
      setTags(data.tags)
      setTag('')
      setBlocked(false)
    } catch (reason) {
      if (active.current && generation === request.current) fail(reason)
    } finally {
      if (active.current && generation === request.current) setLoading(false)
    }
  }, [api, conversationId, fail])
  useEffect(() => {
    // Start outside the render/effect commit; cancel before any unmounted request.
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!dirty && !saving) return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty, saving])
  const editable = !!saved?.canEdit && !loading && !saving && !blocked
  const valid = customerUpdateSchema.safeParse({
    note,
    tags,
    expectedVersion: saved?.version,
  }).success
  function addTag() {
    const value = tag.trim()
    if (
      !value ||
      codepoints(value) > 30 ||
      (!tags.includes(value) && tags.length >= 10)
    )
      return
    setTags((previous) => [...new Set([...previous, value])])
    setTag('')
    setNotice('')
  }
  async function save() {
    if (!editable || !saved || !valid || tag || lock.current) return
    lock.current = true
    guardRef.current = { dirty: true, saving: true }
    setSaving(true)
    setError('')
    setNotice('')
    const generation = ++request.current
    try {
      const data = await api.updateCustomer(conversationId, {
        note,
        tags,
        expectedVersion: saved.version,
      })
      if (!active.current || generation !== request.current) return
      setSaved(data)
      setNote(data.note)
      setTags(data.tags)
      setNotice(
        api.mode === 'demo'
          ? '已更新示範記憶體；重新整理頁面即重設。'
          : '客戶資料已儲存。'
      )
      onSaved(data)
    } catch (reason) {
      if (active.current && generation === request.current) fail(reason)
    } finally {
      lock.current = false
      if (active.current && generation === request.current) setSaving(false)
    }
  }
  return (
    <aside
      className='customer-details'
      aria-label='客戶內部資料'
      aria-busy={loading || saving}
    >
      <h2>客戶內部資料</h2>
      <p className='customer-name' aria-label='客戶暱稱'>
        {customerName.trim() || '未取得暱稱'}
      </p>
      {api.mode === 'demo' && (
        <p className='customer-notice'>
          示範資料僅存本頁記憶體，不會跨重新整理保存，也不呼叫 AI。
        </p>
      )}
      {loading && <p role='status'>正在載入客戶資料…</p>}
      {error && (
        <p className='error-banner' role='alert'>
          {error}
        </p>
      )}
      {saved && (
        <>
          {!saved.canEdit && (
            <p role='note'>客戶資料為唯讀；編輯權限由後端決定。</p>
          )}
          <div className='customer-note-group'>
            <label htmlFor='customer-note'>內部記事</label>
            <textarea
              id='customer-note'
              value={note}
              readOnly={!editable}
              rows={6}
              onChange={(e) => {
                setNote(e.target.value)
                setNotice('')
              }}
              aria-describedby='customer-note-count'
            />
            <small id='customer-note-count'>
              {codepoints(note)} / 5000 字
              {codepoints(note) > 5000 ? ' · 已超過限制' : ''}
            </small>
          </div>
          <div className='customer-tag-group'>
            <h3>客戶標籤（{tags.length} / 10）</h3>
            <ul className='customer-tags'>
              {tags.map((value) => (
                <li key={value}>
                  <span>{value}</span>
                  {saved.canEdit && (
                    <button
                      className='icon-button'
                      aria-label={'移除標籤 ' + value}
                      disabled={!editable}
                      onClick={() => {
                        setTags(tags.filter((t) => t !== value))
                        setNotice('')
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {saved.canEdit && (
              <div className='customer-tag-entry'>
                <label htmlFor='customer-tag'>新增標籤</label>
                <input
                  id='customer-tag'
                  value={tag}
                  disabled={!editable}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <small>
                  {codepoints(tag.trim())} / 30 字 · 去除前後空白、重複標籤合併
                </small>
                <button
                  className='small-button'
                  disabled={
                    !editable ||
                    !tag.trim() ||
                    codepoints(tag.trim()) > 30 ||
                    (tags.length >= 10 && !tags.includes(tag.trim()))
                  }
                  onClick={addTag}
                >
                  加入標籤
                </button>
                {tag && <small>請先加入或清空新增標籤，再儲存。</small>}
              </div>
            )}
          </div>
          <p className='customer-updated'>
            最後更新：{saved.updatedBy?.name ?? '尚無更新人員'}
            <br />
            {saved.updatedAt ? (
              <time dateTime={saved.updatedAt}>
                {new Date(saved.updatedAt).toLocaleString('zh-TW')}
              </time>
            ) : (
              '尚未更新'
            )}
          </p>
          {saved.canEdit && (
            <button
              className='primary-button'
              disabled={!editable || !dirty || !valid || !!tag}
              onClick={() => void save()}
            >
              {saving ? '儲存中…' : '儲存客戶資料'}
            </button>
          )}
          {dirty && <small role='status'>有尚未儲存的客戶資料</small>}
        </>
      )}
      <button
        className='small-button'
        disabled={loading || saving}
        onClick={() => {
          if (
            !dirty ||
            window.confirm('重新載入將捨棄尚未儲存的客戶資料，是否繼續？')
          ) {
            setLoading(true)
            setError('')
            setNotice('')
            void load()
          }
        }}
      >
        重新載入客戶資料
      </button>
      {notice && <p role='status'>{notice}</p>}
    </aside>
  )
}
