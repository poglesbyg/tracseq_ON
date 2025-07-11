import { defineMiddleware } from 'astro:middleware'

// Temporarily disable auth for demo purposes
// import { auth } from './server/auth'

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  // Skip all authentication for demo purposes to avoid database setup issues
  context.locals.userId = undefined
  return await next()
})
