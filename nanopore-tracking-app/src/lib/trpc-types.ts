// Type-only exports for client-side usage
// This file should not import any server-side code

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from './trpc'

export type { AppRouter }
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter> 