'use client'

import { Clock, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ProcessingStep, 
  type ProgressUpdate, 
  type ProcessingMetrics,
  formatDuration,
  formatProgress
} from '@/lib/pdf-progress-tracker'

const formatStepName = (step: ProcessingStep): string => {
  return step.replace(/_/g, ' ').split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

interface PdfProgressProps {
  update: ProgressUpdate
  metrics?: ProcessingMetrics
  showDetails?: boolean
  className?: string
}

export function PdfProgress({ 
  update, 
  metrics, 
  showDetails = false,
  className = '' 
}: PdfProgressProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails)

  const getStepIcon = (step: ProcessingStep) => {
    switch (step) {
      case ProcessingStep.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case ProcessingStep.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
  }

  const getStepColor = (step: ProcessingStep) => {
    switch (step) {
      case ProcessingStep.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
      case ProcessingStep.ERROR:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
    }
  }

  const getProgressColor = (step: ProcessingStep) => {
    switch (step) {
      case ProcessingStep.COMPLETED:
        return 'bg-green-500'
      case ProcessingStep.ERROR:
        return 'bg-red-500'
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStepIcon(update.step)}
            PDF Processing
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getStepColor(update.step)}>
              {formatStepName(update.step)}
            </Badge>
            {metrics && (
              <span className="text-sm text-gray-500">
                {formatProgress(metrics.overallProgress)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{update.message}</span>
            <span className="text-sm text-gray-500">
              {formatProgress(update.progress)}
            </span>
          </div>
          <Progress 
            value={update.progress} 
            className="h-2"
            style={{ 
              background: `linear-gradient(to right, ${getProgressColor(update.step)} 0%, ${getProgressColor(update.step)} ${update.progress}%, #e5e7eb ${update.progress}%, #e5e7eb 100%)` 
            }}
          />
          {update.details && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {update.details}
            </p>
          )}
        </div>

        {/* Time Information */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {update.duration ? formatDuration(update.duration) : '0ms'}
            </span>
          </div>
          {update.estimatedTimeRemaining && update.estimatedTimeRemaining > 0 && (
            <span>
              ~{formatDuration(update.estimatedTimeRemaining)} remaining
            </span>
          )}
        </div>

        {/* Detailed Metrics (Expandable) */}
        {metrics && (
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="text-sm font-medium">Processing Details</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            
            {isExpanded && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Step:</span>
                    <span className="ml-2">{metrics.currentStep + 1} / {metrics.totalSteps}</span>
                  </div>
                  <div>
                    <span className="font-medium">Avg Time:</span>
                    <span className="ml-2">{formatDuration(metrics.averageStepTime)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Elapsed:</span>
                    <span className="ml-2">{formatDuration(metrics.elapsedTime)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Estimated:</span>
                    <span className="ml-2">{formatDuration(metrics.estimatedTotalTime)}</span>
                  </div>
                </div>
                
                {/* Step Progress */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Completed Steps</h4>
                  <div className="space-y-1">
                    {metrics.stepsCompleted.map((step, index) => (
                      <div key={step} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="flex-1">{formatStepName(step)}</span>
                        <span className="text-gray-500 text-xs">
                          Step {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for small spaces
export function PdfProgressCompact({ 
  update, 
  className = '' 
}: { 
  update: ProgressUpdate
  className?: string 
}) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {update.step === ProcessingStep.COMPLETED ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : update.step === ProcessingStep.ERROR ? (
          <AlertCircle className="h-5 w-5 text-red-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
      </div>
      
      {/* Progress Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{update.message}</span>
          <span className="text-xs text-gray-500 ml-2">
            {formatProgress(update.progress)}
          </span>
        </div>
        <Progress value={update.progress} className="h-1" />
      </div>
      
      {/* Time */}
      {update.duration && (
        <div className="flex-shrink-0 text-xs text-gray-500">
          {formatDuration(update.duration)}
        </div>
      )}
    </div>
  )
}

// Progress bar with step indicators
export function PdfProgressSteps({ 
  steps, 
  currentStep, 
  completedSteps = [],
  className = '' 
}: {
  steps: ProcessingStep[]
  currentStep: ProcessingStep
  completedSteps?: ProcessingStep[]
  className?: string
}) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Processing Steps</span>
        <span className="text-xs text-gray-500">
          {completedSteps.length} / {steps.length} completed
        </span>
      </div>
      
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-blue-500 transition-all duration-300"
          style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
        />
        
        {/* Step Indicators */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step)
            const isCurrent = step === currentStep
            
            return (
              <div key={step} className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isCurrent 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 mt-1 text-center max-w-16 truncate">
                  {formatStepName(step)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Toast-style progress notification
export function PdfProgressToast({ 
  update, 
  onClose,
  className = '' 
}: {
  update: ProgressUpdate
  onClose?: () => void
  className?: string
}) {
  const isCompleted = update.step === ProcessingStep.COMPLETED
  const hasError = update.step === ProcessingStep.ERROR
  
  return (
    <div className={`
      fixed top-4 right-4 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
      rounded-lg shadow-lg p-4 transition-all duration-300 ${className}
    `}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : hasError ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{update.message}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            )}
          </div>
          
          {!isCompleted && !hasError && (
            <div className="space-y-1">
              <Progress value={update.progress} className="h-1" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatProgress(update.progress)}</span>
                {update.estimatedTimeRemaining && update.estimatedTimeRemaining > 0 && (
                  <span>~{formatDuration(update.estimatedTimeRemaining)}</span>
                )}
              </div>
            </div>
          )}
          
          {update.details && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {update.details}
            </p>
          )}
        </div>
      </div>
    </div>
  )
} 