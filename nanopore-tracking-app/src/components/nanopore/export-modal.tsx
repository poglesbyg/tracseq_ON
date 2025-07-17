import { useState } from 'react'
import { Calendar, Download, FileText, Database } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api-client'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [includeAllUsers, setIncludeAllUsers] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      toast.error('Start date must be before end date')
      return
    }

    setIsExporting(true)

    try {
      const result = await apiClient.exportSamples({
        startDate: start,
        endDate: end,
        format: exportFormat,
        includeAllUsers,
      })

      // Create and download the file
      const blob = new Blob([result.data], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Export completed successfully!', {
        description: `Downloaded ${result.filename}`,
      })

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleReset = () => {
    setStartDate('')
    setEndDate('')
    setExportFormat('csv')
    setIncludeAllUsers(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Nanopore Samples
          </DialogTitle>
          <DialogDescription>
            Export sample data with lab names for a specific date range
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Range Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="startDate" className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Format Selection */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Export Format</label>
            <div className="grid gap-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="csv"
                  name="format"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4"
                />
                <label htmlFor="csv" className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  CSV (Comma-separated values)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="json"
                  name="format"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4"
                />
                <label htmlFor="json" className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4" />
                  JSON (JavaScript Object Notation)
                </label>
              </div>
            </div>
          </div>

          {/* Include All Users Option */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeAllUsers"
              checked={includeAllUsers}
              onChange={(e) => setIncludeAllUsers(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="includeAllUsers" className="text-sm">
              Include samples from all users (team export)
            </label>
          </div>

          {/* Export Preview */}
          {startDate && endDate && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium text-foreground">Export Preview:</p>
              <div className="mt-1 text-muted-foreground">
                <p>Date Range: {format(new Date(startDate), 'MMM d, yyyy')} to {format(new Date(endDate), 'MMM d, yyyy')}</p>
                <p>Format: {exportFormat.toUpperCase()}</p>
                <p>Scope: {includeAllUsers ? 'All users' : 'Your samples only'}</p>
              </div>
            </div>
          )}

          {/* Included Data Info */}
          <div className="bg-blue-50/50 p-3 rounded-lg text-sm">
            <p className="font-medium text-blue-900">Included Data:</p>
            <ul className="mt-1 text-blue-800 list-disc list-inside">
              <li>Sample details (name, type, project)</li>
              <li>Lab name and submitter information</li>
              <li>Status and priority</li>
              <li>Assignment information</li>
              <li>Submission and processing dates</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !startDate || !endDate}
          >
            {isExporting ? (
              <>
                <Calendar className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}