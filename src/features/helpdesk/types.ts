import type { CalendarApi } from './calendar-client'

export type Staff = {
  id: string
  name: string
  email: string
  role: 'admin' | 'agent'
  canReply?: boolean
}
export type Session = { accessToken: string; staff: Staff }
export type Message = {
  id: string
  conversationId: string
  body: string
  createdAt: string
  authorType: 'customer' | 'ai' | 'agent'
  authorName: string
  status:
    | 'received'
    | 'queued'
    | 'sending'
    | 'sent'
    | 'failed'
    | 'unknown'
    | 'cancelled'
}
export type HistoryCursor = Pick<Message, 'id' | 'createdAt'>
export type Conversation = {
  id: string
  customerName: string
  preview: string
  updatedAt: string
  mode: 'ai' | 'human'
  version: number
  assignedTo: string | null
  unread: number
  tags: string[]
}
export type CustomerDetails = {
  note: string
  tags: string[]
  version: number
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
  canEdit: boolean
}
export type CustomerUpdate = Pick<CustomerDetails, 'note' | 'tags'> & {
  expectedVersion: number
}
export interface HelpdeskApi {
  calendar?: CalendarApi

  getCustomer(conversationId: string): Promise<CustomerDetails>
  updateCustomer(
    conversationId: string,
    update: CustomerUpdate
  ): Promise<CustomerDetails>
  readonly mode: 'demo' | 'live'
  getSession?: () => Promise<Staff>
  subscribe?: (
    changed: () => void,
    status: (state: 'connected' | 'connecting' | 'error') => void
  ) => () => void
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  listConversations(): Promise<Conversation[]>
  listMessages(
    conversationId: string,
    before?: HistoryCursor
  ): Promise<Message[]>
  sendMessage(
    conversationId: string,
    body: string,
    expectedVersion: number,
    requestId: string
  ): Promise<Message>
  setMode(
    conversationId: string,
    mode: 'ai' | 'human',
    expectedVersion: number
  ): Promise<Conversation>
  listStaff(): Promise<Staff[]>
}
