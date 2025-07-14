import { ModernLayout } from '../layout/modern-layout'
import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import { CrisprStudio } from './crispr-studio'

export function CrisprStudioApp() {
  return (
    <TrpcProvider>
      <ModernLayout>
        <CrisprStudio />
        <Toaster />
      </ModernLayout>
    </TrpcProvider>
  )
}
