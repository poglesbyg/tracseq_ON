import { ThemeProvider } from 'next-themes'

import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import { CrisprStudio } from './crispr-studio'

export function CrisprStudioApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TrpcProvider>
        <CrisprStudio />
        <Toaster />
      </TrpcProvider>
    </ThemeProvider>
  )
} 