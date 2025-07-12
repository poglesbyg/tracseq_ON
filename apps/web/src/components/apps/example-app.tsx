import { UNCLayout } from '../layout/unc-layout'
import { TrpcProvider } from '../providers/trpc-provider'

export function ExampleApp() {
  return (
    <TrpcProvider>
      <UNCLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to TracSeq ON
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              AI-Driven Laboratory Management Platform for CRISPR gene editing
              and Oxford Nanopore sequencing workflows
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  CRISPR Design Studio
                </h2>
                <p className="text-muted-foreground mb-4">
                  Design and optimize guide RNAs with AI-powered analysis and
                  off-target prediction.
                </p>
                <a
                  href="/crispr"
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                >
                  Launch CRISPR Studio →
                </a>
              </div>
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Nanopore Tracking
                </h2>
                <p className="text-muted-foreground mb-4">
                  Track Oxford Nanopore sequencing samples with intelligent PDF
                  processing and workflow management.
                </p>
                <a
                  href="/nanopore"
                  className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                >
                  Open Nanopore Dashboard →
                </a>
              </div>
            </div>
          </div>
        </div>
      </UNCLayout>
    </TrpcProvider>
  )
}
