'use client'

import {
  Download,
  FileText,
  Brain,
  AlertCircle,
  X,
} from 'lucide-react'
import { useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { NanoporeFormData } from '@/lib/ai/nanopore-llm-service'

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
  const downloadFile = useCallback(() => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [file])

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

  return (
    <div className="flex h-full max-h-[90vh] bg-white dark:bg-gray-900">
      {/* PDF Info Panel */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
        {/* PDF Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
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
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* PDF Content Area */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>PDF Document</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        File Name:
                      </span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {file.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        File Size:
                      </span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        File Type:
                      </span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {file.type || 'application/pdf'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Last Modified:
                      </span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      PDF content preview is not available in this lightweight version.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Use the download button to view the full PDF in your browser or PDF viewer.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {extractedData ? (
            <>
              {/* Extraction Metadata */}
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Extraction Results</CardTitle>
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
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Confidence:
                    </span>
                    <Badge className={getConfidenceColor(extractedData.confidence)}>
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
                </CardContent>
              </Card>

              {/* Sample Information */}
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sample Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extractedData.sampleName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Sample Name:
                      </span>
                      <p className="text-sm font-medium">{extractedData.sampleName}</p>
                    </div>
                  )}
                  {extractedData.submitterName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Submitter:
                      </span>
                      <p className="text-sm font-medium">{extractedData.submitterName}</p>
                    </div>
                  )}
                  {extractedData.submitterEmail && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Email:
                      </span>
                      <p className="text-sm font-medium">{extractedData.submitterEmail}</p>
                    </div>
                  )}
                  {extractedData.labName && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Lab:
                      </span>
                      <p className="text-sm font-medium">{extractedData.labName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sample Details */}
              {(extractedData.concentration || extractedData.volume || extractedData.priority) && (
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Sample Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {extractedData.concentration && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Concentration:
                        </span>
                        <p className="text-sm font-medium">{extractedData.concentration}</p>
                      </div>
                    )}
                    {extractedData.volume && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Volume:
                        </span>
                        <p className="text-sm font-medium">{extractedData.volume}</p>
                      </div>
                    )}
                    {extractedData.priority && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Priority:
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {extractedData.priority}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Issues */}
              {extractedData.issues && extractedData.issues.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center space-x-1">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>Issues Found</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {extractedData.issues.map((issue, index) => (
                        <li
                          key={index}
                          className="text-sm text-amber-700 dark:text-amber-300"
                        >
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No extracted data available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
