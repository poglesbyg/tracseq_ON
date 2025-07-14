import { ModernLayout } from '../layout/modern-layout'
import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import NanoporeDashboard from './nanopore-dashboard'

export function NanoporeApp() {
  return (
    <TrpcProvider>
      <ModernLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <NanoporeDashboard />
        </div>
        <Toaster />
      </ModernLayout>
    </TrpcProvider>
  )
}
