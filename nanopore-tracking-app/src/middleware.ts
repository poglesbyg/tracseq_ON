import type { MiddlewareHandler } from 'astro'
import { securityHeaders } from './middleware/security/SecurityHeaders'

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Apply security headers to all responses
  const response = await next()
  
  // Apply security headers
  return securityHeaders.applyHeaders(response)
} 