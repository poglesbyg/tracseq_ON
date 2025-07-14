'use client'

import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Brain,
  Eye,
  X,
  Clock,
  Zap,
} from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  nanoporeFormService,
  type NanoporeFormData,
} from '@/lib/ai/nanopore-llm-service'

import PDFViewer from './pdf-viewer'

interface PDFUploadProps {
  onDataExtracted?: (data: NanoporeFormData, file: File) => void
  onFileUploaded?: (file: File) => void
  _sampleId?: string
}

interface UploadedFile {
  file: File
  id: string
  status: 'processing' | 'completed' | 'error'
  extractedData?: NanoporeFormData
  error?: string
  processingTime?: number
}

export default function PDFUpload({
  onDataExtracted,
  onFileUploaded,
  _sampleId,
}: PDFUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true)
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: 'processing' as const,
      }))

      setUploadedFiles((prev) => [...prev, ...newFiles])
      setIsProcessing(true)

      // Process each file
      for (const uploadedFile of newFiles) {
        try {
          // Call the file uploaded callback
          onFileUploaded?.(uploadedFile.file)

          // Extract data using AI
          const startTime = Date.now()
          const result = await nanoporeFormService.extractFormData(
            uploadedFile.file,
          )
          const processingTime = Date.now() - startTime

          if (result.success && result.data) {
            // Update file status
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? {
                      ...f,
                      status: 'completed',
                      extractedData: result.data,
                      processingTime,
                    }
                  : f,
              ),
            )

            // Call the data extracted callback
            onDataExtracted?.(result.data, uploadedFile.file)
          } else {
            // Update file with error
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? {
                      ...f,
                      status: 'error',
                      error: result.error || 'Failed to extract data',
                      processingTime,
                    }
                  : f,
              ),
            )
          }
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: 'error',
                    error:
                      error instanceof Error ? error.message : 'Unknown error',
                  }
                : f,
            ),
          )
        }
      }

      setIsProcessing(false)
    },
    [onDataExtracted, onFileUploaded],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const viewFile = useCallback((uploadedFile: UploadedFile) => {
    setViewingFile(uploadedFile)
  }, [])

  const closeViewer = useCallback(() => {
    setViewingFile(null)
  }, [])

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        )
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
    }
  }

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
        return <Brain className="h-3 w-3" />
      case 'pattern':
        return <FileText className="h-3 w-3" />
      case 'hybrid':
        return (
          <>
            <Brain className="h-2 w-2" />
            <FileText className="h-2 w-2" />
          </>
        )
      default:
        return <FileText className="h-3 w-3" />
    }
  }

  // Show loading state until client-side
  if (!isClient) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>PDF Upload & AI Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If viewing a file, show the PDF viewer
  if (viewingFile) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] overflow-hidden">
          <PDFViewer
            file={viewingFile.file}
            extractedData={viewingFile.extractedData}
            isProcessing={viewingFile.status === 'processing'}
            onClose={closeViewer}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <span>PDF Upload & AI Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isDragActive
                    ? 'Drop PDF files here'
                    : 'Upload PDF Documents'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Drag & drop PDF files or click to browse (max 10MB each)
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Brain className="h-4 w-4" />
                  <span>AI-powered extraction</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="h-4 w-4" />
                  <span>Instant processing</span>
                </div>
              </div>
            </div>
          </div>

          {isProcessing && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  Processing documents with AI...
                </span>
              </div>
              <Progress value={75} className="mt-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <span>Uploaded Documents ({uploadedFiles.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(uploadedFile.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {uploadedFile.file.name}
                        </p>
                        <Badge className={getStatusColor(uploadedFile.status)}>
                          {uploadedFile.status}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>

                        {uploadedFile.processingTime && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{uploadedFile.processingTime}ms</span>
                          </div>
                        )}
                      </div>

                      {uploadedFile.extractedData && (
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center space-x-1">
                            {getMethodIcon(
                              uploadedFile.extractedData.extractionMethod,
                            )}
                            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                              {uploadedFile.extractedData.extractionMethod}
                            </span>
                          </div>

                          <Badge
                            className={getConfidenceColor(
                              uploadedFile.extractedData.confidence,
                            )}
                          >
                            {Math.round(
                              uploadedFile.extractedData.confidence * 100,
                            )}
                            % confidence
                          </Badge>

                          {uploadedFile.extractedData.issues &&
                            uploadedFile.extractedData.issues.length > 0 && (
                              <div className="flex items-center space-x-1 text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                <span>
                                  {uploadedFile.extractedData.issues.length}{' '}
                                  issues
                                </span>
                              </div>
                            )}
                        </div>
                      )}

                      {uploadedFile.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {uploadedFile.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {uploadedFile.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewFile(uploadedFile)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
