import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Card, CardContent } from '../ui/card'
import { 
  X, 
  TestTube, 
  User, 
  FileText, 
  Zap, 
  Loader2,
  Sparkles,
  Save,
  Upload
} from 'lucide-react'
import { toast } from 'sonner'

interface CreateSampleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
}

interface FormData {
  sampleName: string
  projectId: string
  submitterName: string
  submitterEmail: string
  labName: string
  sampleType: string
  concentration: string
  volume: string
  flowCellType: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  chartField: string
  specialInstructions: string
}

const SAMPLE_TYPES = [
  { value: 'DNA', label: 'Genomic DNA' },
  { value: 'RNA', label: 'Total RNA' },
  { value: 'RNA', label: 'mRNA' },
  { value: 'DNA', label: 'Amplicon' },
  { value: 'DNA', label: 'Plasmid DNA' },
  { value: 'DNA', label: 'PCR Product' },
  { value: 'DNA', label: 'cDNA' },
  { value: 'Other', label: 'Other' }
]

const FLOW_CELL_TYPES = [
  'R9.4.1',
  'R10.4.1',
  'R10.5.1',
  'Other'
]

const CHART_FIELDS = [
  'HTSF-001', 'HTSF-002', 'HTSF-003', 'HTSF-004', 'HTSF-005',
  'NANO-001', 'NANO-002', 'NANO-003', 'NANO-004', 'NANO-005',
  'SEQ-001', 'SEQ-002', 'SEQ-003', 'SEQ-004', 'SEQ-005'
]

export default function CreateSampleModal({ isOpen, onClose, onSubmit }: CreateSampleModalProps) {
  const [formData, setFormData] = useState<FormData>({
    sampleName: '',
    projectId: '',
    submitterName: '',
    submitterEmail: '',
    labName: '',
    sampleType: '',
    concentration: '',
    volume: '',
    flowCellType: '',
    priority: 'normal',
    chartField: '',
    specialInstructions: ''
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiAssistance, setAiAssistance] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    // Required field validation
    if (!formData.sampleName.trim()) {
      errors.sampleName = 'Sample name is required'
    }
    
    if (!formData.submitterName.trim()) {
      errors.submitterName = 'Submitter name is required'
    }
    
    if (!formData.submitterEmail.trim()) {
      errors.submitterEmail = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.submitterEmail)) {
      errors.submitterEmail = 'Invalid email format'
    }
    
    if (!formData.sampleType || formData.sampleType.trim() === '') {
      errors.sampleType = 'Sample type is required'
    }
    
    if (!formData.chartField || formData.chartField.trim() === '') {
      errors.chartField = 'Chart field is required'
    }
    
    // Numeric field validation
    if (formData.concentration && formData.concentration.trim() !== '') {
      const concentration = Number(formData.concentration)
      if (isNaN(concentration) || concentration <= 0) {
        errors.concentration = 'Concentration must be a positive number'
      }
    }
    
    if (formData.volume && formData.volume.trim() !== '') {
      const volume = Number(formData.volume)
      if (isNaN(volume) || volume <= 0) {
        errors.volume = 'Volume must be a positive number'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Debug logging
    console.log('Form submission attempted with data:', formData)
    console.log('Form validation state:', validationErrors)
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting')
      return
    }
    
    // Additional validation to ensure required fields are not empty
    const requiredFields = ['sampleName', 'submitterName', 'submitterEmail', 'sampleType', 'chartField']
    const emptyFields = requiredFields.filter(field => {
      const value = formData[field as keyof FormData]
      return !value || !value.toString().trim()
    })
    
    if (emptyFields.length > 0) {
      toast.error(`Please fill in all required fields: ${emptyFields.join(', ')}`)
      console.error('Empty required fields:', emptyFields)
      console.error('Form data values:', requiredFields.map(field => ({ 
        field, 
        value: formData[field as keyof FormData], 
        type: typeof formData[field as keyof FormData] 
      })))
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Convert form data to API format with explicit validation
      const sampleData = {
        sampleName: formData.sampleName.trim(),
        projectId: formData.projectId.trim() || undefined,
        submitterName: formData.submitterName.trim(),
        submitterEmail: formData.submitterEmail.trim(),
        labName: formData.labName.trim() || undefined,
        sampleType: formData.sampleType, // Ensure this is not empty
        sampleBuffer: undefined, // Add if needed
        concentration: formData.concentration && formData.concentration.trim() ? Number(formData.concentration) : undefined,
        volume: formData.volume && formData.volume.trim() ? Number(formData.volume) : undefined,
        totalAmount: undefined, // Will be calculated on backend if concentration and volume provided
        flowCellType: formData.flowCellType || undefined,
        flowCellCount: 1, // Default value
        priority: formData.priority,
        assignedTo: undefined, // Optional field
        libraryPrepBy: undefined, // Optional field
        chartField: formData.chartField, // Ensure this is not empty
      }
      
      // Final validation before submission
      if (!sampleData.sampleName || !sampleData.submitterName || !sampleData.submitterEmail || !sampleData.sampleType || !sampleData.chartField) {
        const missingFields = []
        if (!sampleData.sampleName) missingFields.push('sampleName')
        if (!sampleData.submitterName) missingFields.push('submitterName')
        if (!sampleData.submitterEmail) missingFields.push('submitterEmail')
        if (!sampleData.sampleType) missingFields.push('sampleType')
        if (!sampleData.chartField) missingFields.push('chartField')
        
        console.error('Missing required fields in sampleData:', missingFields)
        console.error('Sample data:', sampleData)
        throw new Error(`Required fields are missing: ${missingFields.join(', ')}`)
      }
      
      console.log('Submitting sample data:', sampleData)
      
      await onSubmit(sampleData)
      toast.success('Sample created successfully!')
      onClose()
      
      // Reset form
      setFormData({
        sampleName: '',
        projectId: '',
        submitterName: '',
        submitterEmail: '',
        labName: '',
        sampleType: '',
        concentration: '',
        volume: '',
        flowCellType: '',
        priority: 'normal',
        chartField: '',
        specialInstructions: ''
      })
      
    } catch (error) {
      console.error('Form submission error:', error)
      
      // More detailed error logging
      if (error && typeof error === 'object') {
        console.error('Error details:', {
          message: (error as any).message,
          data: (error as any).data,
          shape: (error as any).shape,
          stack: (error as any).stack
        })
      }
      
      toast.error(`Failed to create sample: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAiAssistance = async () => {
    setAiAssistance(true)
    
    // Simulate AI assistance
    setTimeout(() => {
      if (formData.sampleType === 'Genomic DNA') {
        setFormData(prev => ({
          ...prev,
          flowCellType: 'R10.4.1',
          volume: prev.volume || '50'
        }))
        toast.success('AI suggested optimal settings for genomic DNA')
      }
      setAiAssistance(false)
    }, 1500)
  }

  const handleUploadPDF = () => {
    toast.info('PDF upload feature coming soon!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TestTube className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Create New Sample</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* AI Assistance Banner */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">AI Assistant</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUploadPDF}
                    className="text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiAssistance}
                    disabled={aiAssistance}
                    className="text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    {aiAssistance ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    Suggest Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sample Name *
              </label>
              <Input
                value={formData.sampleName}
                onChange={(e) => setFormData(prev => ({ ...prev, sampleName: e.target.value }))}
                placeholder="e.g., NANO-001-2024"
                className={validationErrors.sampleName ? 'border-red-500' : ''}
                required
              />
              {validationErrors.sampleName && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.sampleName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project ID
              </label>
              <Input
                value={formData.projectId}
                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                placeholder="e.g., PRJ-2024-001"
              />
            </div>
          </div>

          {/* Submitter Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Submitter Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <Input
                  value={formData.submitterName}
                  onChange={(e) => setFormData(prev => ({ ...prev, submitterName: e.target.value }))}
                  placeholder="Dr. Jane Smith"
                  className={validationErrors.submitterName ? 'border-red-500' : ''}
                  required
                />
                {validationErrors.submitterName && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.submitterName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <Input
                  type="email"
                  value={formData.submitterEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, submitterEmail: e.target.value }))}
                  placeholder="jane.smith@university.edu"
                  className={validationErrors.submitterEmail ? 'border-red-500' : ''}
                  required
                />
                {validationErrors.submitterEmail && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.submitterEmail}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lab Name
              </label>
              <Input
                value={formData.labName}
                onChange={(e) => setFormData(prev => ({ ...prev, labName: e.target.value }))}
                placeholder="Genomics Research Lab"
              />
            </div>
          </div>

          {/* Sample Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <TestTube className="h-5 w-5 mr-2" />
              Sample Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sample Type *
                </label>
                <select
                  value={formData.sampleType}
                  onChange={(e) => setFormData(prev => ({ ...prev, sampleType: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md bg-white text-sm ${
                    validationErrors.sampleType ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select sample type *</option>
                  {SAMPLE_TYPES.map(type => (
                    <option key={`${type.value}-${type.label}`} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {validationErrors.sampleType && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.sampleType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Cell Type
                </label>
                <select
                  value={formData.flowCellType}
                  onChange={(e) => setFormData(prev => ({ ...prev, flowCellType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="">Select flow cell type</option>
                  {FLOW_CELL_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concentration (ng/μL)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.concentration}
                  onChange={(e) => setFormData(prev => ({ ...prev, concentration: e.target.value }))}
                  placeholder="125.5"
                  className={validationErrors.concentration ? 'border-red-500' : ''}
                />
                {validationErrors.concentration && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.concentration}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volume (μL)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.volume}
                  onChange={(e) => setFormData(prev => ({ ...prev, volume: e.target.value }))}
                  placeholder="50"
                  className={validationErrors.volume ? 'border-red-500' : ''}
                />
                {validationErrors.volume && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.volume}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as FormData['priority'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Financial Information
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chart Field *
              </label>
              <select
                value={formData.chartField}
                onChange={(e) => setFormData(prev => ({ ...prev, chartField: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md bg-white text-sm ${
                  validationErrors.chartField ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select chart field *</option>
                {CHART_FIELDS.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
              {validationErrors.chartField && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.chartField}</p>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              value={formData.specialInstructions}
              onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
              placeholder="Any special handling requirements or notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Sample
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 