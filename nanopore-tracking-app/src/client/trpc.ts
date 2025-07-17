import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../lib/trpc-types'

export const trpc = createTRPCReact<AppRouter>() 