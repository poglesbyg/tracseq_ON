import { ThemeProvider } from 'next-themes'

import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import NanoporeDashboard from './nanopore-dashboard'

export function NanoporeApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TrpcProvider>
        <NanoporeDashboard />
        <Toaster />
      </TrpcProvider>
    </ThemeProvider>
  )
} 