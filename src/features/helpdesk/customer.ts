import { z } from 'zod'

export const codepoints = (text: string) => [...text].length
const note = z.string().refine((value) => codepoints(value) <= 5000)
const tag = z
  .string()
  .trim()
  .refine((value) => codepoints(value) > 0 && codepoints(value) <= 30)
const tags = z
  .array(tag)
  .max(10)
  .transform((values) => [...new Set(values)])
export const customerUpdateSchema = z.object({
  note,
  tags,
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})
export const customerSchema = z.object({
  note,
  tags,
  version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedBy: z.object({ id: z.string().min(1), name: z.string() }).nullable(),
  canEdit: z.boolean(),
})
