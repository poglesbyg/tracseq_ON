import { UNCLayout } from '../layout/unc-layout'
import { TrpcProvider } from '../providers/trpc-provider'
import { Toaster } from '../ui/sonner'

import NanoporeDashboard from './nanopore-dashboard'

export function NanoporeApp() {
  return (
    <TrpcProvider>
      <UNCLayout>
        <div className="container mx-auto px-4 py-8">
          <NanoporeDashboard />
        </div>
        <Toaster />
      </UNCLayout>
    </TrpcProvider>
  )
}
