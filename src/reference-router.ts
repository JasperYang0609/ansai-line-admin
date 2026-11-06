// 上游 routes 僅留作學員原始碼參考；主入口不匯入本模組，因此不提供展示頁或 Clerk 登入。
// 保留 Router 的型別註冊，讓參考範例仍能通過 TypeScript；新增產品頁面請放 helpdesk 模組。
import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const _referenceRouter = createRouter({
  routeTree,
  context: { queryClient: new QueryClient() },
})
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof _referenceRouter
  }
}
