import { 
  Edit, 
  Calendar, 
  Save,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Input } from '../ui/input'

// Helper function to safely format dates
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Not available'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString()
  } catch (error) {
    return 'Invalid date'
  }
}

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

interface EditTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, updateData: Partial<NanoporeSample>) => void
  sample: NanoporeSample | null
  isLoading?: boolean
}

export function EditTaskModal({
  isOpen,
  onClose,
  onSave,
  sample,
  isLoading = false,
}: EditTaskModalProps) {
  const [formData, setFormData] = useState({
    sampleName: '',
    projectId: '',
    submitterName: '',
    submitterEmail: '',
    labName: '',
    sampleType: 'DNA',
    status: 'submitted',
    priority: 'normal',
    assignedTo: '',
    libraryPrepBy: '',
  })

  useEffect(() => {
    if (sample) {
      setFormData({
        sampleName: sample.sampleName || '',
        projectId: sample.projectId || '',
        submitterName: sample.submitterName || '',
        submitterEmail: sample.submitterEmail || '',
        labName: sample.labName || '',
        sampleType: sample.sampleType || 'DNA',
        status: sample.status || 'submitted',
        priority: sample.priority || 'normal',
        assignedTo: sample.assignedTo || '',
        libraryPrepBy: sample.libraryPrepBy || '',
      })
    }
  }, [sample])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sample) return

    // Required field validation
    if (
      !formData.sampleName.trim() ||
      !formData.submitterName.trim() ||
      !formData.submitterEmail.trim()
    ) {
      toast.error('Please fill in all required fields')
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.submitterEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    // Sample name validation (alphanumeric, dashes, underscores)
    const sampleNameRegex = /^[a-zA-Z0-9_-]+$/
    if (!sampleNameRegex.test(formData.sampleName)) {
      toast.error('Sample name can only contain letters, numbers, dashes, and underscores')
      return
    }

    // Workflow status validation
    const validStatusTransitions: Record<string, string[]> = {
      'submitted': ['prep', 'archived'],
      'prep': ['sequencing', 'submitted', 'archived'],
      'sequencing': ['analysis', 'prep', 'archived'],
      'analysis': ['completed', 'sequencing', 'archived'],
      'completed': ['archived'],
      'archived': []
    }

    const currentStatus = sample.status || 'submitted'
    const newStatus = formData.status
    const allowedTransitions = validStatusTransitions[currentStatus] || []
    
    if (newStatus !== currentStatus && !allowedTransitions.includes(newStatus)) {
      toast.error(`Invalid status transition from ${currentStatus} to ${newStatus}`)
      return
    }

    // Priority validation for urgent samples
    if (formData.priority === 'urgent' && !formData.assignedTo.trim()) {
      toast.error('Urgent samples must be assigned to a team member')
      return
    }

    const updateData: Partial<NanoporeSample> = {
      sampleName: formData.sampleName.trim(),
      projectId: formData.projectId.trim() || null,
      submitterName: formData.submitterName.trim(),
      submitterEmail: formData.submitterEmail.trim(),
      labName: formData.labName.trim() || null,
      sampleType: formData.sampleType,
      status: formData.status as any,
      priority: formData.priority as any,
      assignedTo: formData.assignedTo.trim() || null,
      libraryPrepBy: formData.libraryPrepBy.trim() || null,
    }

    onSave(sample.id, updateData)
  }

  const handleCancel = () => {
    onClose()
  }

  if (!sample) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Sample
          </DialogTitle>
          <DialogDescription>
            Edit sample details and update processing information for {sample.sampleName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Sample Name */}
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

          {/* Project ID */}
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

          {/* Submitter Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Lab Name */}
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

          {/* Sample Type and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              >
                <option value="submitted">Submitted</option>
                <option value="prep">Prep</option>
                <option value="sequencing">Sequencing</option>
                <option value="analysis">Analysis</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  priority: e.target.value,
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

          {/* Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Assigned To
              </label>
              <Input
                value={formData.assignedTo}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    assignedTo: e.target.value,
                  }))
                }
                placeholder="e.g., Grey"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                Library Prep By
              </label>
              <Input
                value={formData.libraryPrepBy}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    libraryPrepBy: e.target.value,
                  }))
                }
                placeholder="e.g., Stephanie"
              />
            </div>
          </div>

          {/* System Information (Read-only) */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-foreground">System Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sample.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sample.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}