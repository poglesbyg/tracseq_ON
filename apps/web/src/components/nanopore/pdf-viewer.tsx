'use client'

import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Brain,
  AlertCircle,
} from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { NanoporeFormData } from '@/lib/ai/nanopore-llm-service'

// Dynamic imports for PDF.js to avoid SSR issues
let Document: any = null
let Page: any = null
let pdfjs: any = null

interface PDFViewerProps {
  file: File
  extractedData?: NanoporeFormData
  isProcessing?: boolean
  onClose?: () => void
}

export default function PDFViewer({
  file,
  extractedData,
  isProcessing = false,
  onClose,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [pdfLoaded, setPdfLoaded] = useState(false)

  // Initialize PDF.js on client side only
  useEffect(() => {
    setIsClient(true)

    const loadPdfJs = async () => {
      try {
        const pdfModule = await import('react-pdf')
        Document = pdfModule.Document
        Page = pdfModule.Page
        pdfjs = pdfModule.pdfjs

        // Configure PDF.js worker
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

        setPdfLoaded(true)
      } catch (error) {
        console.error('Failed to load PDF.js:', error)
        setError('Failed to load PDF viewer')
      }
    }

    void loadPdfJs()
  }, [])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      setError(null)
    },
    [],
  )

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`Failed to load PDF: ${error.message}`)
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(numPages, prev + 1))
  }, [numPages])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(3.0, prev + 0.2))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, prev - 0.2))
  }, [])

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const downloadFile = useCallback(() => {
    if (!isClient) {
      return
    }

    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [file, isClient])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'bg-green-100 text-green-800'
    }
    if (confidence >= 0.6) {
      return 'bg-yellow-100 text-yellow-800'
    }
    return 'bg-red-100 text-red-800'
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'llm':
        return <Brain className="h-4 w-4" />
      case 'pattern':
        return <FileText className="h-4 w-4" />
      case 'hybrid':
        return (
          <>
            <Brain className="h-3 w-3" />
            <FileText className="h-3 w-3" />
          </>
        )
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  // Don't render PDF viewer until client-side and PDF.js is loaded
  if (!isClient || !pdfLoaded) {
    return (
      <div className="flex h-full max-h-[90vh] bg-white dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading PDF viewer...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full max-h-[90vh] bg-white dark:bg-gray-900">
      {/* PDF Viewer Panel */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
        {/* PDF Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {file.name}
            </span>
            <Badge variant="outline" className="ml-2">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadFile}
              className="flex items-center space-x-1"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>

        {/* PDF Navigation */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 3.0}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" onClick={rotate}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
          <div className="flex justify-center">
            {error ? (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            ) : (
              Document &&
              Page && (
                <Document
                  file={file}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span>Loading PDF...</span>
                    </div>
                  }
                  className="shadow-lg"
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    rotate={rotation}
                    loading={
                      <div className="flex items-center justify-center h-96 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    }
                    className="shadow-lg border border-gray-300 dark:border-gray-600"
                  />
                </Document>
              )
            )}
          </div>
        </div>
      </div>

      {/* Extracted Data Panel */}
      <div className="w-96 flex flex-col bg-gray-50 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <span>AI Extracted Data</span>
          </h3>
          {isProcessing && (
            <div className="flex items-center space-x-2 mt-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Processing document...</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {extractedData ? (
            <>
              {/* Extraction Metadata */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Extraction Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Method:
                    </span>
                    <div className="flex items-center space-x-1">
                      {getMethodIcon(extractedData.extractionMethod)}
                      <span className="text-sm font-medium capitalize">
                        {extractedData.extractionMethod}
                      </span>
                      {extractedData.extractionMethod === 'rag' && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-xs bg-purple-100 text-purple-800"
                        >
                          AI Enhanced
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Confidence:
                    </span>
                    <Badge
                      className={getConfidenceColor(extractedData.confidence)}
                    >
                      {Math.round(extractedData.confidence * 100)}%
                    </Badge>
                  </div>
                  {extractedData.processingTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Processing Time:
                      </span>
                      <span className="text-sm font-medium">
                        {extractedData.processingTime}ms
                      </span>
                    </div>
                  )}
                  {extractedData.issues && extractedData.issues.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Issues:
                      </span>
                      <ul className="mt-1 space-y-1">
                        {extractedData.issues.map((issue, index) => (
                          <li
                            key={index}
                            className="flex items-center space-x-2 text-sm text-amber-600"
                          >
                            <AlertCircle className="h-3 w-3" />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RAG Insights */}
              {extractedData.ragInsights && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center space-x-2">
                      <Brain className="h-4 w-4 text-purple-600" />
                      <span>RAG Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Field Matches:
                      </span>
                      <span className="text-sm font-medium">
                        {extractedData.ragInsights.matches.length} found
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Overall Confidence:
                      </span>
                      <Badge
                        className={getConfidenceColor(
                          extractedData.ragInsights.overallConfidence,
                        )}
                      >
                        {Math.round(
                          extractedData.ragInsights.overallConfidence * 100,
                        )}
                        %
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Extracted Fields:
                      </span>
                      <span className="text-sm font-medium">
                        {extractedData.ragInsights.extractedFields} /{' '}
                        {extractedData.ragInsights.totalFields}
                      </span>
                    </div>
                    {extractedData.ragInsights.processingTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          RAG Time:
                        </span>
                        <span className="text-sm font-medium">
                          {extractedData.ragInsights.processingTime}ms
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* RAG Recommendations */}
              {extractedData.ragRecommendations &&
                extractedData.ragRecommendations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span>Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {extractedData.ragRecommendations.map(
                          (recommendation, index) => (
                            <li
                              key={index}
                              className="flex items-start space-x-2 text-sm"
                            >
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-gray-700 dark:text-gray-300">
                                {recommendation}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}

              {/* Basic Information */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.sampleName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Sample Name:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.sampleName}
                      </p>
                    </div>
                  )}
                  {extractedData.submitterName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Submitter:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.submitterName}
                      </p>
                    </div>
                  )}
                  {extractedData.submitterEmail && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Email:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.submitterEmail}
                      </p>
                    </div>
                  )}
                  {extractedData.labName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Lab:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.labName}
                      </p>
                    </div>
                  )}
                  {extractedData.projectName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Project:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.projectName}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sequencing Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sequencing Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.sequencingType && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Type:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {extractedData.sequencingType}
                      </Badge>
                    </div>
                  )}
                  {extractedData.sampleType && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Sample Type:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {extractedData.sampleType}
                      </Badge>
                    </div>
                  )}
                  {extractedData.libraryType && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Library:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {extractedData.libraryType}
                      </Badge>
                    </div>
                  )}
                  {extractedData.flowCellType && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Flow Cell:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {extractedData.flowCellType}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sample Metrics */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sample Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.concentration && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Concentration:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.concentration}
                      </p>
                    </div>
                  )}
                  {extractedData.volume && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Volume:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.volume}
                      </p>
                    </div>
                  )}
                  {extractedData.purity && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Purity:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.purity}
                      </p>
                    </div>
                  )}
                  {extractedData.fragmentSize && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Fragment Size:
                      </span>
                      <p className="text-sm font-medium">
                        {extractedData.fragmentSize}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Processing Options */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Processing Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.priority && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Priority:
                      </span>
                      <Badge
                        variant={
                          extractedData.priority === 'Rush'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="ml-2"
                      >
                        {extractedData.priority}
                      </Badge>
                    </div>
                  )}
                  {extractedData.basecalling && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Basecalling:
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {extractedData.basecalling}
                      </Badge>
                    </div>
                  )}
                  {extractedData.demultiplexing !== undefined && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Demultiplexing:
                      </span>
                      <Badge
                        variant={
                          extractedData.demultiplexing ? 'default' : 'outline'
                        }
                        className="ml-2"
                      >
                        {extractedData.demultiplexing ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bioinformatics */}
              {(extractedData.referenceGenome ||
                extractedData.analysisType ||
                extractedData.dataDelivery) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Bioinformatics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {extractedData.referenceGenome && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Reference:
                        </span>
                        <p className="text-sm font-medium">
                          {extractedData.referenceGenome}
                        </p>
                      </div>
                    )}
                    {extractedData.analysisType && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Analysis:
                        </span>
                        <p className="text-sm font-medium">
                          {extractedData.analysisType}
                        </p>
                      </div>
                    )}
                    {extractedData.dataDelivery && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Data Delivery:
                        </span>
                        <p className="text-sm font-medium">
                          {extractedData.dataDelivery}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No extracted data available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
