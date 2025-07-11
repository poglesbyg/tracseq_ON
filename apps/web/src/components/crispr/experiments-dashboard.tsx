import {
  Plus,
  Calendar,
  Dna,
  FlaskConical,
  Archive,
  Trash2,
  Edit,
  ExternalLink,
} from 'lucide-react'
import { useState } from 'react'

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

type Experiment = {
  id: string
  name: string
  description: string | null
  targetOrganism: string | null
  experimentType: string | null
  status: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

// Mock data for development when not authenticated
const mockExperiments: Experiment[] = [
  {
    id: '1',
    name: 'GRIN1 Knockout Study',
    description: 'Investigating NMDA receptor function in neuronal development',
    targetOrganism: 'Homo sapiens',
    experimentType: 'knockout',
    status: 'completed',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    createdBy: 'dev-user',
  },
  {
    id: '2',
    name: 'CFTR Gene Correction',
    description: 'Therapeutic approach for cystic fibrosis',
    targetOrganism: 'Homo sapiens',
    experimentType: 'knockin',
    status: 'analyzing',
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-25'),
    createdBy: 'dev-user',
  },
  {
    id: '3',
    name: 'Cancer Cell Line Screen',
    description: 'CRISPR screening for essential genes in cancer cells',
    targetOrganism: 'Homo sapiens',
    experimentType: 'screening',
    status: 'draft',
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25'),
    createdBy: 'dev-user',
  },
]

interface ExperimentCardProps {
  experiment: Experiment
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
}

function ExperimentCard({
  experiment,
  onEdit,
  onDelete,
  onView,
}: ExperimentCardProps) {
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'analyzing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'archived':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case 'knockout':
        return <Dna className="h-4 w-4" />
      case 'knockin':
        return <FlaskConical className="h-4 w-4" />
      case 'screening':
        return <Archive className="h-4 w-4" />
      default:
        return <Dna className="h-4 w-4" />
    }
  }

  return (
    <Card className="hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 bg-white/5 border-white/20 backdrop-blur-sm hover:border-white/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-white">
              {experiment.name}
            </CardTitle>
            <CardDescription className="text-sm text-slate-300">
              {experiment.description || 'No description provided'}
            </CardDescription>
          </div>
          <Badge className={`${getStatusColor(experiment.status)} border-0`}>
            {experiment.status || 'draft'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            {getTypeIcon(experiment.experimentType)}
            <span className="capitalize">
              {experiment.experimentType || 'knockout'}
            </span>
          </div>
          {experiment.targetOrganism && (
            <div className="flex items-center gap-1">
              <FlaskConical className="h-4 w-4" />
              <span>{experiment.targetOrganism}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          <span>Created {experiment.createdAt.toLocaleDateString()}</span>
          {experiment.updatedAt.getTime() !==
            experiment.createdAt.getTime() && (
            <span>• Updated {experiment.updatedAt.toLocaleDateString()}</span>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(experiment.id)}
            className="flex-1 border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(experiment.id)}
            className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(experiment.id)}
            className="border-red-400/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-400/70 transition-all duration-200"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateExperimentForm({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetOrganism: '',
    experimentType: 'knockout' as 'knockout' | 'knockin' | 'screening',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      return
    }

    // Simulate experiment creation for development
    console.log('Development mode: Creating experiment:', formData)
    onSuccess()
    setIsOpen(false)
    setFormData({
      name: '',
      description: '',
      targetOrganism: '',
      experimentType: 'knockout',
    })
    alert('Development Mode: Experiment created! (Not saved to database)')
  }

  if (!isOpen) {
    return (
      <Card className="border-dashed border-2 hover:border-purple-400 hover:bg-white/10 transition-all duration-200 cursor-pointer bg-white/5 border-white/30">
        <CardContent
          className="flex flex-col items-center justify-center py-8 text-center"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-8 w-8 text-purple-400 mb-2" />
          <CardTitle className="text-lg text-white">
            Create New Experiment
          </CardTitle>
          <CardDescription className="text-slate-400">
            Start a new CRISPR design project
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 border-white/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">Create New Experiment</CardTitle>
        <CardDescription className="text-slate-400">
          Set up a new CRISPR design project (Development Mode)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., GRIN1 knockout study"
              required
              className="bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Description
            </label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Brief description of the experiment goals"
              className="bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Target Organism
            </label>
            <Input
              value={formData.targetOrganism}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  targetOrganism: e.target.value,
                }))
              }
              placeholder="e.g., Homo sapiens, Mus musculus"
              className="bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-white">
              Experiment Type
            </label>
            <select
              value={formData.experimentType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  experimentType: e.target.value as
                    | 'knockout'
                    | 'knockin'
                    | 'screening',
                }))
              }
              className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            >
              <option value="knockout">Knockout</option>
              <option value="knockin">Knock-in</option>
              <option value="screening">Screening</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!formData.name.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Create Experiment (Dev Mode)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-white/30 bg-white/5 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ExperimentsDashboard() {
  // Try to load real data, but fall back to mock data if not authenticated
  const {
    data: realExperiments,
    isLoading,
    error,
  } = trpc.experiments.getAll.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Use mock data if there's an authentication error
  const experiments = error?.data?.code === 'UNAUTHORIZED' ? mockExperiments : realExperiments
  const isUsingMockData = error?.data?.code === 'UNAUTHORIZED'

  const handleDelete = (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this experiment? This action cannot be undone.',
      )
    ) {
      if (isUsingMockData) {
        alert('Development Mode: Delete functionality not available with mock data')
      } else {
        console.log('Delete experiment:', id)
        alert('Delete functionality would be implemented here')
      }
    }
  }

  const handleEdit = (id: string) => {
    // Navigate to edit page (to be implemented)
    window.location.assign(`/crispr/experiment/${id}/edit`)
  }

  const handleView = (id: string) => {
    // Navigate to experiment detail page
    window.location.assign(`/crispr/experiment/${id}`)
  }

  const handleSuccess = () => {
    console.log('Experiment created successfully')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">My Experiments</h1>
            <p className="text-slate-400">Manage your CRISPR design projects</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-3/4 mb-2 bg-white/20" />
                <Skeleton className="h-3 w-full mb-4 bg-white/20" />
                <Skeleton className="h-3 w-1/2 mb-2 bg-white/20" />
                <Skeleton className="h-8 w-full bg-white/20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">My Experiments</h1>
          <p className="text-slate-400">
            {experiments?.length
              ? `${experiments.length} experiment${experiments.length !== 1 ? 's' : ''} ${isUsingMockData ? '(Demo Data)' : ''}`
              : 'No experiments yet'}
          </p>
        </div>
      </div>

      {/* Development Mode Notice */}
      {isUsingMockData && (
        <Card className="bg-yellow-500/10 border-yellow-500/20 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span>Development Mode: Using mock data (authentication disabled)</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CreateExperimentForm onSuccess={handleSuccess} />

        {experiments?.map((experiment) => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
          />
        ))}
      </div>

      {experiments?.length === 0 && (
        <div className="text-center py-12">
          <Dna className="h-12 w-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No experiments yet
          </h3>
          <p className="text-slate-400">
            Create your first CRISPR design experiment to get started
          </p>
        </div>
      )}

      {/* Database Status Indicator */}
      <div className="fixed bottom-4 right-4">
        <Card className={`${isUsingMockData ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'} backdrop-blur-sm`}>
          <CardContent className="p-3">
            <div className={`flex items-center gap-2 ${isUsingMockData ? 'text-yellow-400' : 'text-green-400'} text-sm`}>
              <div className={`w-2 h-2 ${isUsingMockData ? 'bg-yellow-400' : 'bg-green-400'} rounded-full animate-pulse`}></div>
              <span>{isUsingMockData ? 'Development Mode (Mock Data)' : 'PostgreSQL Database Connected'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
