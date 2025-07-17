'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { trpc } from '@/client/trpc'

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Always refetch data
        gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (formerly cacheTime)
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // You can add headers here if needed
          // headers() {
          //   return {
          //     authorization: getAuthCookie(),
          //   }
          // },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
} 