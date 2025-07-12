import { appRouter, getUser, type Context } from '@app/api'
import { setupDb } from '@app/db'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { APIRoute } from 'astro'
import { DATABASE_URL } from 'astro:env/server'

import { auth } from '@/server/auth'
import { env } from '@/server/env'

export const prerender = false

interface CreateContextOptions {
  req: Request
}

async function createContext({ req }: CreateContextOptions): Promise<Context> {
  // Initialize database connection with explicit DATABASE_URL
  const db = setupDb(DATABASE_URL)

  const session = await auth.api.getSession({ headers: req.headers })

  const user = session?.user.id
    ? await getUser({ db, userId: session.user.id })
    : null

  return { db, session: session ?? null, env, user }
}

export const ALL: APIRoute = (options) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: options.request,
    router: appRouter,
    createContext: (opts) => createContext({ req: opts.req }),
  })
}
