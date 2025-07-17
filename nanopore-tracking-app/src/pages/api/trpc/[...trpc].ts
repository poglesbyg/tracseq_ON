import type { APIRoute } from 'astro'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createTRPCContext, createAppRouter } from '@/lib/trpc'
import { securityHeaders } from '@/middleware/security/SecurityHeaders'

let appRouter: Awaited<ReturnType<typeof createAppRouter>> | undefined

export const ALL: APIRoute = async ({ request }) => {
  // Create the router instance if it doesn't exist
  if (!appRouter) {
    appRouter = await createAppRouter()
  }

  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: createTRPCContext,
  })
  
  return securityHeaders.applyHeaders(response)
} 