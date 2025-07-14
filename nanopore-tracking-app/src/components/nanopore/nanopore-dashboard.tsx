import {
  Plus,
  TestTube,
  Clock,
  Archive,
  Trash2,
  Edit,
  ExternalLink,
  Users,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  FileText,
  Upload,
  Brain,
  Download,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { trpc } from '@/client/trpc'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'

import { AssignModal } from './assign-modal'
import { EditTaskModal } from './edit-task-modal'
import { ExportModal } from './export-modal'
import PdfUpload from './pdf-upload'
import { ViewTaskModal } from './view-task-modal'

type NanoporeSample = {
  id: string
  sampleName: string
  projectId: string | null
  submitterName: string
  submitterEmail: string
  labName: string | null
  sampleType: string
  status: string | null
  priority: string | null
  assignedTo: string | null
  libraryPrepBy: string | null
  submittedAt: Date
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

// Mock data for development when not authenticated
const mockNanoporeSamples: NanoporeSample[] = [
  {
    id: '1',
    sampleName: 'Human_DNA_Sample_001',
    projectId: 'HTSF-CJ-001',
    submitterName: 'Dr. Sarah Johnson',
    submitterEmail: 'sarah.johnson@unc.edu',
    labName: 'Johnson Lab',
    sampleType: 'DNA',
    status: 'prep',
    priority: 'high',
    assignedTo: 'Grey',
    libraryPrepBy: 'Stephanie',
    submittedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-16'),
    createdBy: 'dev-user',
  },
  {
    id: '2',
    sampleName: 'Plant_Genome_Sample_002',
    projectId: 'HTSF-CJ-002',
    submitterName: 'Dr. Michael Chen',
    submitterEmail: 'michael.chen@unc.edu',
    labName: 'Chen Lab',
    sampleType: 'DNA',
    status: 'sequencing',
    priority: 'normal',
    assignedTo: 'Tara',
    libraryPrepBy: 'Jenny',
    submittedAt: new Date('2024-01-18'),
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-20'),
    createdBy: 'dev-user',
  },
  {
    id: '3',
    sampleName: 'Bacterial_Culture_003',
    projectId: 'HTSF-CJ-003',
    submitterName: 'Dr. Lisa Rodriguez',
    submitterEmail: 'lisa.rodriguez@unc.edu',
    labName: 'Rodriguez Lab',
    sampleType: 'DNA',
    status: 'submitted',
    priority: 'urgent',
    assignedTo: null,
    libraryPrepBy: null,
    submittedAt: new Date('2024-01-22'),
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-22'),
    createdBy: 'dev-user',
  },
]

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'prep':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'sequencing':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'analysis':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'archived':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'normal':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'submitted':
      return <Clock className="h-4 w-4" />
    case 'prep':
      return <Play className="h-4 w-4" />
    case 'sequencing':
      return <TestTube className="h-4 w-4" />
    case 'analysis':
      return <AlertCircle className="h-4 w-4" />
    case 'completed':
      return <CheckCircle className="h-4 w-4" />
    case 'archived':
      return <Archive className="h-4 w-4" />
    default:
      return <Pause className="h-4 w-4" />
  }
}

interface NanoporeSampleCardProps {
  sample: NanoporeSample
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
  onAssign: (id: string) => void
}

function NanoporeSampleCard({
  sample,
  onEdit,
  onDelete,
  onView,
  onAssign,
}: NanoporeSampleCardProps) {
  return (
    <Card className="bg-card border-border hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-foreground mb-1">
              {sample.sampleName}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {sample.projectId && (
                <span className="text-sm font-medium">
                  Project: {sample.projectId}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={getPriorityColor(sample.priority)}>
              {sample.priority || 'normal'}
            </Badge>
            <Badge className={getStatusColor(sample.status)}>
              <div className="flex items-center gap-1">
                {getStatusIcon(sample.status)}
                {sample.status || 'unknown'}
              </div>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Submitter:</span>
            <span className="text-foreground font-medium">{sample.submitterName}</span>
          </div>
          <div className="flex justify-between">
            <span>Lab:</span>
            <span className="text-foreground font-medium">
              {sample.labName || 'Not specified'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sample Type:</span>
            <span className="text-foreground font-medium">{sample.sampleType}</span>
          </div>
          {sample.assignedTo && (
            <div className="flex justify-between">
              <span>Assigned to:</span>
              <span className="text-foreground font-medium">{sample.assignedTo}</span>
            </div>
          )}
          {sample.libraryPrepBy && (
            <div className="flex justify-between">
              <span>Library Prep:</span>
              <span className="text-foreground font-medium">{sample.libraryPrepBy}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Submitted:</span>
            <span className="text-foreground font-medium">
              {sample.submittedAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(sample.id)}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAssign(sample.id)}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1" />
            Assign
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(sample.id)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(sample.id)}
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateNanoporeSampleForm({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual' | 'pdf'>('manual')
  const [formData, setFormData] = useState({
    sampleName: '',
    projectId: '',
    submitterName: '',
    submitterEmail: '',
    labName: '',
    sampleType: 'DNA',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    chartField: '',
  })

  // Add create mutation
  const createMutation = trpc.nanopore.create.useMutation({
    onSuccess: () => {
      onSuccess()
      setIsOpen(false)
      setFormData({
        sampleName: '',
        projectId: '',
        submitterName: '',
        submitterEmail: '',
        labName: '',
        sampleType: 'DNA',
        priority: 'normal',
        chartField: '',
      })
      toast.success('Nanopore sample created successfully!')
    },
    onError: (error) => {
      toast.error('Failed to create nanopore sample', {
        description: error.message
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !formData.sampleName.trim() ||
      !formData.submitterName.trim() ||
      !formData.submitterEmail.trim() ||
      !formData.chartField.trim()
    ) {
      return
    }

    // Use the database save mutation
    createMutation.mutate(formData)
  }

  const handlePdfDataExtracted = useCallback((data: any, file: File) => {
    // Auto-fill form with extracted data
    setFormData((prev) => ({
      ...prev,
      sampleName: data.sampleName || prev.sampleName,
      submitterName: data.submitterName || prev.submitterName,
      submitterEmail: data.submitterEmail || prev.submitterEmail,
      labName: data.labName || prev.labName,
      projectId: data.projectName || prev.projectId,
      sampleType: data.sequencingType || prev.sampleType,
      priority: data.priority?.toLowerCase() || prev.priority,
      chartField: data.chartField || prev.chartField,
    }))

    // Show success message with extraction info
    toast.success('PDF data extracted successfully!', {
      description: `Extracted data from ${file.name} using ${data.extractionMethod} method with ${Math.round(data.confidence * 100)}% confidence.`,
    })

    // Switch to manual entry tab to review the data
    setActiveTab('manual')
  }, [])

  const handleFileUploaded = useCallback((file: File) => {
    toast.info('Processing PDF...', {
      description: `Analyzing ${file.name} with AI to extract form data.`,
    })
  }, [])

  if (!isOpen) {
    return (
      <Card className="border-dashed border-2 hover:border-primary hover:bg-muted/50 transition-all duration-200 cursor-pointer bg-muted/20 border-border">
        <CardContent
          className="flex flex-col items-center justify-center py-8 text-center"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-8 w-8 text-primary mb-2" />
          <CardTitle className="text-lg text-foreground">
            Submit New Sample
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Add a new Nanopore sequencing sample
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Submit New Sample</CardTitle>
        <CardDescription className="text-muted-foreground">
          Add a new sample for Nanopore sequencing
        </CardDescription>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'manual'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'pdf'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Upload PDF
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'pdf' ? (
          <div className="space-y-4">
            <PdfUpload
              onDataExtracted={handlePdfDataExtracted}
              onFileUploaded={handleFileUploaded}
            />
            <div className="text-center">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium text-primary">
                    AI-Powered Data Extraction
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Our AI system can extract form data from Nanopore submission
                  PDFs with high accuracy. It uses both LLM analysis and pattern
                  matching for reliable results.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span>• Sample information</span>
                  <span>• Sequencing parameters</span>
                  <span>• Contact details</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab('manual')}
              >
                Or fill manually instead
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Sample Name *
              </label>
              <Input
                value={formData.sampleName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sampleName: e.target.value,
                  }))
                }
                placeholder="e.g., Human_DNA_Sample_001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Project ID
              </label>
              <Input
                value={formData.projectId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    projectId: e.target.value,
                  }))
                }
                placeholder="e.g., HTSF-CJ-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Submitter Name *
              </label>
              <Input
                value={formData.submitterName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    submitterName: e.target.value,
                  }))
                }
                placeholder="e.g., Dr. Sarah Johnson"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Submitter Email *
              </label>
              <Input
                type="email"
                value={formData.submitterEmail}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    submitterEmail: e.target.value,
                  }))
                }
                placeholder="e.g., sarah.johnson@unc.edu"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Lab Name
              </label>
              <Input
                value={formData.labName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, labName: e.target.value }))
                }
                placeholder="e.g., Johnson Lab"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Sample Type
              </label>
              <select
                value={formData.sampleType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sampleType: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              >
                <option value="DNA">DNA</option>
                <option value="RNA">RNA</option>
                <option value="cDNA">cDNA</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: e.target.value as
                      | 'low'
                      | 'normal'
                      | 'high'
                      | 'urgent',
                  }))
                }
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Chart Field *
              </label>
              <select
                value={formData.chartField}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    chartField: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              >
                <option value="">Select a chart field</option>
                <option value="HTSF-001">HTSF-001</option>
                <option value="HTSF-002">HTSF-002</option>
                <option value="HTSF-003">HTSF-003</option>
                <option value="HTSF-004">HTSF-004</option>
                <option value="HTSF-005">HTSF-005</option>
                <option value="NANO-001">NANO-001</option>
                <option value="NANO-002">NANO-002</option>
                <option value="NANO-003">NANO-003</option>
                <option value="NANO-004">NANO-004</option>
                <option value="NANO-005">NANO-005</option>
                <option value="SEQ-001">SEQ-001</option>
                <option value="SEQ-002">SEQ-002</option>
                <option value="SEQ-003">SEQ-003</option>
                <option value="SEQ-004">SEQ-004</option>
                <option value="SEQ-005">SEQ-005</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Chart field must be part of the intake validation list
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isLoading}
              >
                {createMutation.isLoading ? 'Creating...' : 'Submit Sample'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={createMutation.isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function NanoporeDashboard() {
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [selectedSample, setSelectedSample] = useState<NanoporeSample | null>(null)
  
  // Try to load real data, but fall back to mock data if not authenticated
  const {
    data: realSamples,
    isLoading,
    error,
    refetch,
  } = trpc.nanopore.getAll.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Use mock data if there's an authentication error
  const samples =
    error?.data?.code === 'UNAUTHORIZED' ? mockNanoporeSamples : realSamples
  const isUsingMockData = error?.data?.code === 'UNAUTHORIZED'

  // Assignment mutation
  const assignMutation = trpc.nanopore.assign.useMutation({
    onSuccess: () => {
      void refetch()
    },
    onError: (error) => {
      toast.error('Failed to assign sample', {
        description: error.message
      })
    }
  })

  // Update mutation
  const updateMutation = trpc.nanopore.update.useMutation({
    onSuccess: () => {
      void refetch()
      setEditModalOpen(false)
      setSelectedSample(null)
      toast.success('Sample updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update sample', {
        description: error.message
      })
    }
  })

  const handleDelete = (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this sample? This action cannot be undone.',
      )
    ) {
      if (isUsingMockData) {
        alert(
          'Development Mode: Delete functionality not available with mock data',
        )
      } else {
        console.log('Delete sample:', id)
        alert('Delete functionality would be implemented here')
      }
    }
  }

  const handleEdit = (id: string) => {
    const sample = samples?.find(s => s.id === id)
    if (sample) {
      setSelectedSample(sample)
      setEditModalOpen(true)
    }
  }

  const handleView = (id: string) => {
    const sample = samples?.find(s => s.id === id)
    if (sample) {
      setSelectedSample(sample)
      setViewModalOpen(true)
    }
  }

  const handleAssign = (id: string) => {
    const sample = samples?.find(s => s.id === id)
    if (sample) {
      setSelectedSample(sample)
      setAssignModalOpen(true)
    }
  }

  const handleAssignmentSubmit = (assignedTo: string, libraryPrepBy?: string) => {
    if (!selectedSample) {
      return
    }
    
    if (isUsingMockData) {
      toast.info('Development Mode: Assignment not saved to database', {
        description: `Would assign ${selectedSample.sampleName} to ${assignedTo}${libraryPrepBy ? ` with library prep by ${libraryPrepBy}` : ''}`
      })
      return
    }

    assignMutation.mutate({
      id: selectedSample.id,
      assignedTo,
      libraryPrepBy,
    })
  }

  const handleEditSubmit = (id: string, updateData: Partial<NanoporeSample>) => {
    if (isUsingMockData) {
      toast.info('Development Mode: Changes not saved to database', {
        description: `Would update ${updateData.sampleName || 'sample'} with new data`
      })
      setEditModalOpen(false)
      setSelectedSample(null)
      return
    }

    updateMutation.mutate({
      id,
      data: updateData,
    })
  }

  const handleSuccess = () => {
    void refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Nanopore Queue</h2>
            <p className="text-muted-foreground">
              Oxford Nanopore sequencing sample tracking
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Nanopore Queue</h2>
          <p className="text-muted-foreground">
            Oxford Nanopore sequencing sample tracking
            {isUsingMockData && (
              <span className="ml-2 text-orange-600">(Development Mode)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CreateNanoporeSampleForm onSuccess={handleSuccess} />
        {samples?.map((sample) => (
          <NanoporeSampleCard
            key={sample.id}
            sample={sample}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            onAssign={handleAssign}
          />
        ))}
      </div>

      {samples?.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <TestTube className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No samples yet
          </h3>
          <p className="text-muted-foreground">
            Submit your first Nanopore sequencing sample to get started.
          </p>
        </div>
      )}

      {selectedSample && (
        <AssignModal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onAssign={handleAssignmentSubmit}
          currentAssignment={{
            assignedTo: selectedSample.assignedTo,
            libraryPrepBy: selectedSample.libraryPrepBy,
          }}
          sampleName={selectedSample.sampleName}
        />
      )}

      <EditTaskModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEditSubmit}
        sample={selectedSample}
        isLoading={updateMutation.isLoading}
      />

      <ViewTaskModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        sample={selectedSample}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  )
}
