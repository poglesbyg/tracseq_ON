import React, { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Users, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Archive, 
  FileText, 
  Download, 
  Send, 
  RotateCcw, 
  AlertTriangle, 
  Copy, 
  MessageSquare,
  Zap,
  TestTube,
  Microscope,
  FlaskConical,
  BarChart3,
  ChevronRight,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react'

interface SampleActionsProps {
  sample: any
  onViewSample: (sample: any) => void
  onEditSample: (sample: any) => void
  onAssignSample: (sample: any) => void
  onDeleteSample: (sample: any) => void
  onStatusUpdate: (sample: any, newStatus: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived') => void
  onWorkflowAction: (sample: any, action: string, data?: any) => void
  actionLoading?: string | null
  isAdmin?: boolean
}

export const SampleActions: React.FC<SampleActionsProps> = ({
  sample,
  onViewSample,
  onEditSample,
  onAssignSample,
  onDeleteSample,
  onStatusUpdate,
  onWorkflowAction,
  actionLoading,
  isAdmin = false
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [workflowActionsOpen, setWorkflowActionsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const quickActionsRef = useRef<HTMLDivElement>(null)
  const workflowActionsRef = useRef<HTMLDivElement>(null)

  const isLoading = actionLoading === sample.id

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setQuickActionsOpen(false)
      }
      if (workflowActionsRef.current && !workflowActionsRef.current.contains(event.target as Node)) {
        setWorkflowActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get workflow actions based on current status
  const getWorkflowActions = () => {
    const actions = []
    
    switch (sample.status) {
      case 'submitted':
        actions.push(
          { id: 'start_prep', label: 'Start Prep', icon: Play, color: 'text-blue-600' },
          { id: 'request_info', label: 'Request Info', icon: MessageSquare, color: 'text-yellow-600' },
          { id: 'reject', label: 'Reject Sample', icon: XCircle, color: 'text-red-600' }
        )
        break
      case 'prep':
        actions.push(
          { id: 'qc_pass', label: 'QC Pass', icon: CheckCircle, color: 'text-green-600' },
          { id: 'qc_fail', label: 'QC Fail', icon: XCircle, color: 'text-red-600' },
          { id: 'pause_prep', label: 'Pause Prep', icon: Pause, color: 'text-yellow-600' },
          { id: 'library_prep', label: 'Start Library Prep', icon: FlaskConical, color: 'text-purple-600' }
        )
        break
      case 'sequencing':
        actions.push(
          { id: 'start_run', label: 'Start Run', icon: Play, color: 'text-blue-600' },
          { id: 'pause_run', label: 'Pause Run', icon: Pause, color: 'text-yellow-600' },
          { id: 'stop_run', label: 'Stop Run', icon: Square, color: 'text-red-600' },
          { id: 'quality_check', label: 'Quality Check', icon: Microscope, color: 'text-green-600' }
        )
        break
      case 'analysis':
        actions.push(
          { id: 'generate_report', label: 'Generate Report', icon: FileText, color: 'text-blue-600' },
          { id: 'quality_analysis', label: 'Quality Analysis', icon: BarChart3, color: 'text-purple-600' },
          { id: 'approve_results', label: 'Approve Results', icon: CheckCircle, color: 'text-green-600' },
          { id: 'request_reanalysis', label: 'Request Re-analysis', icon: RefreshCw, color: 'text-yellow-600' }
        )
        break
      case 'completed':
        actions.push(
          { id: 'deliver_results', label: 'Deliver Results', icon: Send, color: 'text-blue-600' },
          { id: 'archive', label: 'Archive Sample', icon: Archive, color: 'text-gray-600' },
          { id: 'create_report', label: 'Create Report', icon: FileText, color: 'text-green-600' }
        )
        break
    }
    
    return actions
  }

  // Get quick actions based on status
  const getQuickActions = () => {
    const actions = []
    
    // Status progression
    const statusProgression = {
      'submitted': 'prep',
      'prep': 'sequencing',
      'sequencing': 'analysis',
      'analysis': 'completed',
      'completed': 'archived'
    }
    
    const nextStatus = statusProgression[sample.status as keyof typeof statusProgression]
    // Status progression actions
    if (nextStatus) {
      actions.push({
        id: 'next_status',
        label: `→ ${nextStatus}`,
        icon: ChevronRight,
        color: 'text-blue-600',
        action: () => onStatusUpdate(sample, nextStatus as 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived')
      })
    }
    
    // Priority actions
    if (sample.priority !== 'urgent') {
      actions.push({
        id: 'mark_urgent',
        label: 'Mark Urgent',
        icon: AlertTriangle,
        color: 'text-red-600',
        action: () => onWorkflowAction(sample, 'update_priority', { priority: 'urgent' })
      })
    }
    
    // Common actions
    actions.push({
      id: 'add_note',
      label: 'Add Note',
      icon: MessageSquare,
      color: 'text-yellow-600',
      action: () => onWorkflowAction(sample, 'add_note')
    })
    
    return actions
  }

  // Get contextual actions based on sample properties
  const getContextualActions = () => {
    const actions = []
    
    // Quality control actions
    if (sample.qc_status === 'pending') {
      actions.push({ id: 'perform_qc', label: 'Perform QC', icon: Microscope, color: 'text-blue-600' })
    }
    
    // File actions
    if (sample.has_files) {
      actions.push({ id: 'download_files', label: 'Download Files', icon: Download, color: 'text-green-600' })
    }
    
    // Duplicate action
    actions.push({ id: 'duplicate', label: 'Duplicate Sample', icon: Copy, color: 'text-gray-600' })
    
    // Reprocess action for failed samples
    if (sample.status === 'failed') {
      actions.push({ id: 'reprocess', label: 'Reprocess', icon: RotateCcw, color: 'text-blue-600' })
    }
    
    return actions
  }

  const handleWorkflowAction = (actionId: string) => {
    setDropdownOpen(false)
    setQuickActionsOpen(false)
    setWorkflowActionsOpen(false)
    
    // Handle specific workflow actions
    switch (actionId) {
      case 'qc_pass':
        onWorkflowAction(sample, 'qc_result', { result: 'pass' })
        break
      case 'qc_fail':
        onWorkflowAction(sample, 'qc_result', { result: 'fail' })
        break
      case 'start_prep':
        onStatusUpdate(sample, 'prep')
        break
      case 'library_prep':
        onWorkflowAction(sample, 'start_library_prep')
        break
      case 'start_run':
        onWorkflowAction(sample, 'start_sequencing_run')
        break
      case 'generate_report':
        onWorkflowAction(sample, 'generate_report')
        break
      case 'deliver_results':
        onWorkflowAction(sample, 'deliver_results')
        break
      case 'archive':
        onStatusUpdate(sample, 'archived')
        break
      case 'duplicate':
        onWorkflowAction(sample, 'duplicate_sample')
        break
      case 'reprocess':
        onWorkflowAction(sample, 'reprocess_sample')
        break
      default:
        onWorkflowAction(sample, actionId)
    }
  }

  const workflowActions = getWorkflowActions()
  const quickActions = getQuickActions()
  const contextualActions = getContextualActions()

  return (
    <div className="flex items-center space-x-2">
      {/* Priority Badge */}
      {sample.priority === 'urgent' && (
        <Badge variant="destructive" className="animate-pulse">
          <AlertTriangle className="h-3 w-3 mr-1" />
          URGENT
        </Badge>
      )}
      
      {/* Status Badge */}
      <Badge 
        variant={sample.status === 'completed' ? 'default' : 'secondary'}
        className={`${
          sample.status === 'failed' ? 'bg-red-100 text-red-700' :
          sample.status === 'completed' ? 'bg-green-100 text-green-700' :
          sample.status === 'sequencing' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}
      >
        {sample.status}
      </Badge>
      
      {/* Quick Actions */}
      <div className="relative">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setQuickActionsOpen(!quickActionsOpen)}
          className="flex items-center space-x-1"
          disabled={isLoading}
        >
          <Zap className="h-3 w-3" />
          <span>Quick</span>
        </Button>
        
        {quickActionsOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50" ref={quickActionsRef}>
            <div className="py-1">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => action.action ? action.action() : handleWorkflowAction(action.id)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${action.color}`}
                >
                  <action.icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Workflow Actions */}
      {workflowActions.length > 0 && (
        <div className="relative">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setWorkflowActionsOpen(!workflowActionsOpen)}
            className="flex items-center space-x-1 border-blue-200 text-blue-600 hover:bg-blue-50"
            disabled={isLoading}
          >
            <TestTube className="h-3 w-3" />
            <span>Workflow</span>
          </Button>
          
          {workflowActionsOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Workflow Actions
                </div>
                {workflowActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      handleWorkflowAction(action.id)
                      setWorkflowActionsOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${action.color}`}
                  >
                    <action.icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Main Actions Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-1"
          disabled={isLoading}
        >
          <MoreHorizontal className="h-3 w-3" />
          <span>Actions</span>
        </Button>
        
        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              {/* View and Edit Actions */}
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Management
              </div>
              <button
                onClick={() => {
                  onViewSample(sample)
                  setDropdownOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Eye className="h-4 w-4" />
                <span>View Details</span>
              </button>
              
              <button
                onClick={() => {
                  onEditSample(sample)
                  setDropdownOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Sample</span>
              </button>
              
              <button
                onClick={() => {
                  onAssignSample(sample)
                  setDropdownOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Assign Staff</span>
              </button>
              
              {/* Contextual Actions */}
              {contextualActions.length > 0 && (
                <>
                  <div className="border-t border-gray-100 my-1"></div>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Additional Actions
                  </div>
                  {contextualActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleWorkflowAction(action.id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${action.color}`}
                    >
                      <action.icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </>
              )}
              
              {/* Admin Actions */}
              {isAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1"></div>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Admin Actions
                  </div>
                  <button
                    onClick={() => handleWorkflowAction('audit_trail')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>View Audit Trail</span>
                  </button>
                  
                  <button
                    onClick={() => handleWorkflowAction('export_data')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Data</span>
                  </button>
                </>
              )}
              
              {/* Danger Zone */}
              <div className="border-t border-gray-100 my-1"></div>
              <div className="px-3 py-2 text-xs font-medium text-red-500 uppercase tracking-wide">
                Danger Zone
              </div>
              <button
                onClick={() => {
                  onDeleteSample(sample)
                  setDropdownOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Sample</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Processing...</span>
        </div>
      )}
    </div>
  )
}

export default SampleActions 