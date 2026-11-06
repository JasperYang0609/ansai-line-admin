export type Staff = {
  id: string
  name: string
  email: string
  role: 'admin' | 'agent'
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
export interface HelpdeskApi {
  readonly mode: 'demo' | 'live'
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  listConversations(): Promise<Conversation[]>
  listMessages(conversationId: string): Promise<Message[]>
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
