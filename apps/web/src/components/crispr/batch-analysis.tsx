import {
  Upload,
  FileText,
  Play,
  Download,
  BarChart3,
  FileSpreadsheet,
  FileJson,
  TrendingUp,
  Target,
  CheckCircle,
  AlertTriangle,
  Clock,
  Dna,
} from 'lucide-react'
import { useState, useCallback, useRef } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from 'recharts'

import {
  type BatchSequence,
  type BatchProcessingResult,
  type BatchProcessingProgress,
  parseFASTASequences,
  parseCSVSequences,
  processBatchSequences,
  exportBatchResults,
  generateComparisonReport,
} from '../../lib/crispr/batch-processing'
import type { DesignParameters } from '../../lib/crispr/guide-design'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Input } from '../ui/input'
import { Progress } from '../ui/progress'
import { Separator } from '../ui/separator'

interface BatchAnalysisProps {
  designParameters: DesignParameters
}

export function BatchAnalysis({ designParameters }: BatchAnalysisProps) {
  const [sequences, setSequences] = useState<BatchSequence[]>([])
  const [results, setResults] = useState<BatchProcessingResult | null>(null)
  const [progress, setProgress] = useState<BatchProcessingProgress | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'fasta' | 'csv'>('fasta')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        setError(null)
        const content = await file.text()

        let parsedSequences: BatchSequence[]
        if (selectedFormat === 'fasta') {
          parsedSequences = parseFASTASequences(content)
        } else {
          parsedSequences = parseCSVSequences(content)
        }

        if (parsedSequences.length === 0) {
          throw new Error('No valid sequences found in the uploaded file')
        }

        setSequences(parsedSequences)
        setResults(null) // Clear previous results
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file')
        setSequences([])
      }
    },
    [selectedFormat],
  )

  const handleProcessSequences = useCallback(async () => {
    if (sequences.length === 0) {
      return
    }

    setIsProcessing(true)
    setError(null)
    setProgress(null)

    try {
      const result = await processBatchSequences(
        sequences,
        designParameters,
        (progressUpdate) => {
          setProgress(progressUpdate)
        },
      )
      setResults(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }, [sequences, designParameters])

  const handleExport = useCallback(
    (format: 'csv' | 'json' | 'summary') => {
      if (!results) {
        return
      }

      try {
        const exportedData = exportBatchResults(results, format)
        const blob = new Blob([exportedData], {
          type: format === 'json' ? 'application/json' : 'text/plain',
        })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `batch-analysis-${Date.now()}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (_err) {
        setError('Failed to export results')
      }
    },
    [results],
  )

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  // Prepare chart data
  const chartData = results
    ? results.results.map((result) => ({
        name:
          result.sequenceName.length > 15
            ? result.sequenceName.substring(0, 15) + '...'
            : result.sequenceName,
        fullName: result.sequenceName,
        totalGuides: result.summary.totalGuides,
        efficiency: result.summary.averageEfficiency * 100,
        specificity: result.summary.averageSpecificity * 100,
        recommended: result.summary.recommendedGuides,
        recommendationRate:
          (result.summary.recommendedGuides / result.summary.totalGuides) * 100,
        highEfficiency: result.summary.highEfficiencyGuides,
        lowRisk: result.summary.lowRiskGuides,
      }))
    : []

  const summaryStats = results
    ? [
        {
          name: 'Sequences',
          value: results.totalSequences,
          icon: Dna,
          color: '#8b5cf6',
        },
        {
          name: 'Total Guides',
          value: results.overallSummary.totalGuides,
          icon: Target,
          color: '#10b981',
        },
        {
          name: 'Avg per Sequence',
          value: Math.round(results.overallSummary.averageGuidesPerSequence),
          icon: BarChart3,
          color: '#f59e0b',
        },
        {
          name: 'Success Rate',
          value: `${(results.overallSummary.overallSuccessRate * 100).toFixed(1)}%`,
          icon: CheckCircle,
          color: '#3b82f6',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Batch Sequence Upload
          </CardTitle>
          <CardDescription>
            Upload multiple sequences for batch guide RNA design and analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex gap-2">
              <Button
                variant={selectedFormat === 'fasta' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFormat('fasta')}
              >
                <FileText className="h-4 w-4 mr-1" />
                FASTA
              </Button>
              <Button
                variant={selectedFormat === 'csv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFormat('csv')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>

            <div className="flex-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept={selectedFormat === 'fasta' ? '.fasta,.fa,.txt' : '.csv'}
                onChange={handleFileUpload}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          </div>

          {selectedFormat === 'fasta' && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <strong>FASTA Format:</strong> Each sequence should start with a
              header line beginning with &apos;&gt;&apos; followed by sequence
              data. Example: &gt;Gene1|Description
            </div>
          )}

          {selectedFormat === 'csv' && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <strong>CSV Format:</strong> Must include &apos;name&apos; and
              &apos;sequence&apos; columns. Optional: &apos;type&apos; and
              &apos;description&apos; columns.
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {sequences.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {sequences.length} sequences loaded
                </div>
                <Button
                  onClick={handleProcessSequences}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Start Analysis'}
                </Button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1">
                {sequences.map((seq, _index) => (
                  <div
                    key={seq.id}
                    className="text-xs bg-muted p-2 rounded flex justify-between"
                  >
                    <span className="font-mono">{seq.name}</span>
                    <span className="text-muted-foreground">
                      {seq.sequence.length} bp
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Section */}
      {progress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    Processing {progress.currentSequenceName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Sequence {progress.currentSequence} of{' '}
                    {progress.totalSequences} • {progress.currentStep}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {progress.percentage.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(progress.estimatedTimeRemaining)} remaining
                  </div>
                </div>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryStats.map((stat, _index) => (
              <Card key={stat.name}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: stat.color + '20' }}
                    >
                      <stat.icon
                        className="h-4 w-4"
                        style={{ color: stat.color }}
                      />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">
                        {stat.name}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('json')}
                >
                  <FileJson className="h-4 w-4 mr-1" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('summary')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Summary
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Charts and Visualizations */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Efficiency vs Specificity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Efficiency vs Specificity
                </CardTitle>
                <CardDescription>
                  Guide RNA performance by sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis
                      dataKey="efficiency"
                      label={{
                        value: 'Efficiency (%)',
                        position: 'insideBottom',
                        offset: -5,
                      }}
                    />
                    <YAxis
                      dataKey="specificity"
                      label={{
                        value: 'Specificity (%)',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <div className="font-medium">{data.fullName}</div>
                              <div className="text-sm space-y-1">
                                <div>
                                  Efficiency: {data.efficiency.toFixed(1)}%
                                </div>
                                <div>
                                  Specificity: {data.specificity.toFixed(1)}%
                                </div>
                                <div>Total Guides: {data.totalGuides}</div>
                              </div>
                            </div>
                          )
                        }
                        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                        return null
                      }}
                    />
                    <Scatter dataKey="specificity" fill="#8b5cf6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Guide Counts by Sequence */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guide RNA Counts</CardTitle>
                <CardDescription>
                  Total and recommended guides per sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      content={({ active, payload, label: _label }) => {
                        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <div className="font-medium">{data.fullName}</div>
                              <div className="text-sm space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                                  Total: {data.totalGuides}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                                  Recommended: {data.recommended}
                                </div>
                              </div>
                            </div>
                          )
                        }
                        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
                        return null
                      }}
                    />
                    <Bar
                      dataKey="totalGuides"
                      fill="#8b5cf6"
                      name="Total Guides"
                    />
                    <Line
                      type="monotone"
                      dataKey="recommended"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Recommended"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recommendation Rate Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Success Rate Distribution
                </CardTitle>
                <CardDescription>
                  Percentage of recommended guides per sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis dataKey="name" />
                    <YAxis
                      label={{
                        value: 'Success Rate (%)',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label: _label }) => {
                        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <div className="font-medium">{data.fullName}</div>
                              <div className="text-sm">
                                Success Rate:{' '}
                                {data.recommendationRate.toFixed(1)}%
                              </div>
                            </div>
                          )
                        }
                        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="recommendationRate"
                      stroke="#f59e0b"
                      fill="url(#successGradient)"
                    />
                    <defs>
                      <linearGradient
                        id="successGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Analysis Summary</CardTitle>
                <CardDescription>
                  Processing time: {formatTime(results.processingTime)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Best Sequence</div>
                      <div className="font-medium">
                        {results.overallSummary.bestSequenceName}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Processing Time
                      </div>
                      <div className="font-medium">
                        {formatTime(results.processingTime)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="font-medium text-sm">Recommendations</div>
                    {generateComparisonReport(results).recommendations.map(
                      (rec, _index) => (
                        <div
                          key={_index}
                          className="text-sm text-muted-foreground flex items-start gap-2"
                        >
                          <TrendingUp className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                          {rec}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
