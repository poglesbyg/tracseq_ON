import { initTRPC } from '@trpc/server'

// Create tRPC context
export const createTRPCContext = async () => {
  // Only import database on server side
  if (typeof window === 'undefined') {
    const { db } = await import('./database')
    return { db }
  }
  
  // This should never be called on client side for API routes
  throw new Error('Database context cannot be created on client side')
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

// Create app router without importing nanopore router directly
// This prevents database code from being bundled for the client
export const createAppRouter = async () => {
  // Dynamically import the nanopore router only on the server
  const { nanoporeRouter } = await import('./api/nanopore')
  
  return router({
    nanopore: nanoporeRouter,
  })
}

// Export type for client-side usage
export type AppRouter = Awaited<ReturnType<typeof createAppRouter>> 