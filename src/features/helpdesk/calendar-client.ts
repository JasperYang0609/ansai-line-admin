import { z } from 'zod'

const rulesSchema = z.object({
  timeZone: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)),
  opens: z.string(),
  closes: z.string(),
  durationMinutes: z.number().int(),
  bufferBefore: z.number().int(),
  bufferAfter: z.number().int(),
  excludedDates: z.array(z.string()),
})
const settingsSchema = z.object({
  calendarId: z.string(),
  service: z.string(),
  rules: rulesSchema,
  eligibility: z.enum(['open', 'approval']),
  enabled: z.boolean(),
  version: z.number().int().nonnegative(),
})
const recordSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  eventId: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.enum([
    'offered',
    'writing',
    'unknown',
    'confirmed',
    'unavailable',
    'cancelled',
  ]),
  syncStatus: z.enum(['ok', 'conflict', 'error']).nullable().optional(),
  syncedAt: z.string().nullable().optional(),
  service: z.string(),
  timeZone: z.string(),
})
export type CalendarSettings = z.infer<typeof settingsSchema>
export type BookingRecord = z.infer<typeof recordSchema>
function checked<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw Error('日曆回應不完整，請核對後端版本。')
  return result.data
}
export function createCalendarApi(
  call: (path: string, init?: RequestInit) => Promise<unknown>
) {
  return {
    async status() {
      return checked(
        z.object({
          state: z.enum(['unconnected', 'connected', 'reconnect']),
          isOwner: z.boolean(),
        }),
        await call('/calendar/status')
      )
    },
    async connect() {
      const data = checked(
        z.object({ authorizationUrl: z.string() }),
        await call('/calendar/connect', { method: 'POST' })
      )
      const u = new URL(data.authorizationUrl)
      if (
        u.origin !== 'https://accounts.google.com' ||
        u.pathname !== '/o/oauth2/v2/auth' ||
        u.username ||
        u.password ||
        u.searchParams.has('client_secret') ||
        u.searchParams.has('access_token') ||
        u.searchParams.get('access_type') !== 'offline' ||
        u.searchParams.get('code_challenge_method') !== 'S256'
      )
        throw Error('授權連結不符合安全設定。')
      return u.href
    },
    async calendars() {
      return checked(
        z.object({
          calendars: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              timeZone: z.string(),
              writable: z.boolean(),
            })
          ),
        }),
        await call('/calendar/calendars')
      )
    },
    async settings() {
      return checked(
        z.object({ settings: settingsSchema.nullable() }),
        await call('/calendar/settings')
      )
    },
    async save(settings: CalendarSettings) {
      return checked(
        z.object({ version: z.number().int().positive() }),
        await call('/calendar/settings', {
          method: 'POST',
          body: JSON.stringify(settings),
        })
      )
    },
    async bookings(before?: { createdAt: string; id: string }) {
      return checked(
        z.object({
          bookings: z.array(recordSchema),
          next: z
            .object({ createdAt: z.string(), id: z.string() })
            .nullable()
            .optional(),
        }),
        await call(
          '/calendar/bookings' +
            (before
              ? '?' +
                new URLSearchParams({
                  beforeAt: before.createdAt,
                  beforeId: before.id,
                })
              : '')
        )
      )
    },
    async counts(startDate: string, endDate: string) {
      const date = /^\d{4}-\d{2}-\d{2}$/
      if (!date.test(startDate) || !date.test(endDate) || startDate > endDate)
        throw Error('預約統計日期無效。')
      const result = checked(
        z.object({
          counts: z.array(
            z.object({
              date: z.string().regex(date),
              count: z.number().int().nonnegative(),
            })
          ),
        }),
        await call(
          '/calendar/booking-counts?' +
            new URLSearchParams({ startDate, endDate })
        )
      )
      const seen = new Set<string>()
      for (const row of result.counts) {
        if (row.date < startDate || row.date > endDate || seen.has(row.date))
          throw Error('預約統計回應不完整，請核對後端版本。')
        seen.add(row.date)
      }
      return result
    },
    async sync() {
      return checked(
        z.object({
          checked: z.number().int().nonnegative(),
          updated: z.number().int().nonnegative(),
          cancelled: z.number().int().nonnegative(),
          conflicts: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
          remaining: z.number().int().nonnegative(),
        }),
        await call('/calendar/sync', { method: 'POST' })
      )
    },
    async pause() {
      return checked(
        z.object({ enabled: z.literal(false) }),
        await call('/calendar/pause', { method: 'POST' })
      )
    },
    async reconcile(id: string) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('預約識別碼無效。')
      return checked(
        z.object({
          status: z.enum([
            'offered',
            'writing',
            'unknown',
            'confirmed',
            'unavailable',
            'cancelled',
          ]),
        }),
        await call('/calendar/bookings/' + id + '/reconcile', {
          method: 'POST',
        })
      )
    },
    async approve(conversationId: string, settingsVersion: number) {
      return checked(
        z.object({ approved: z.literal(true) }),
        await call('/calendar/approve', {
          method: 'POST',
          body: JSON.stringify({ conversationId, settingsVersion }),
        })
      )
    },
  }
}
export type CalendarApi = ReturnType<typeof createCalendarApi>
