import { ModernLayout } from '../layout/modern-layout'
import { TrpcProvider } from '../providers/trpc-provider'

export function ExampleApp() {
  return (
    <TrpcProvider>
      <ModernLayout>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Welcome to Laboratory Management System
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Modern laboratory management platform for CRISPR gene editing
              and Oxford Nanopore sequencing workflows
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-white rounded-sm"></div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  CRISPR Design Studio
                </h2>
                <p className="text-gray-600 mb-6">
                  Design and optimize guide RNAs with AI-powered analysis and
                  off-target prediction.
                </p>
                <a
                  href="/crispr"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-lg"
                >
                  Launch CRISPR Studio →
                </a>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-white rounded-sm"></div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Nanopore Tracking
                </h2>
                <p className="text-gray-600 mb-6">
                  Track Oxford Nanopore sequencing samples with intelligent PDF
                  processing and workflow management.
                </p>
                <a
                  href="/nanopore"
                  className="inline-flex items-center text-green-600 hover:text-green-700 font-medium text-lg"
                >
                  Open Nanopore Dashboard →
                </a>
              </div>
            </div>
          </div>
        </div>
      </ModernLayout>
    </TrpcProvider>
  )
}
