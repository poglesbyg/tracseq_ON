import { UNCLayout } from '../layout/unc-layout'
import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import { CrisprStudio } from './crispr-studio'

export function CrisprStudioApp() {
  return (
    <TrpcProvider>
      <UNCLayout>
        <CrisprStudio />
        <Toaster />
      </UNCLayout>
    </TrpcProvider>
  )
}
