export interface CreateSampleData {
  sampleName: string
  projectId?: string | undefined
  submitterName: string
  submitterEmail: string
  labName?: string | undefined
  sampleType: string
  sampleBuffer?: string | undefined
  concentration?: number | undefined
  volume?: number | undefined
  totalAmount?: number | undefined
  flowCellType?: string | undefined
  flowCellCount?: number | undefined
  priority?: 'low' | 'normal' | 'high' | 'urgent' | undefined
  assignedTo?: string | undefined
  libraryPrepBy?: string | undefined
  chartField: string
}

export interface UpdateSampleData {
  sampleName?: string
  projectId?: string
  submitterName?: string
  submitterEmail?: string
  labName?: string
  sampleType?: string
  sampleBuffer?: string
  concentration?: number
  volume?: number
  totalAmount?: number
  flowCellType?: string
  flowCellCount?: number
  status?: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo?: string
  libraryPrepBy?: string
}

export interface Sample {
  id: string
  sample_name: string
  project_id: string | null
  submitter_name: string
  submitter_email: string
  lab_name: string | null
  sample_type: string
  sample_buffer: string | null
  concentration: number | null
  volume: number | null
  total_amount: number | null
  flow_cell_type: string | null
  flow_cell_count: number
  status: string
  priority: string
  assigned_to: string | null
  library_prep_by: string | null
  chart_field: string
  submitted_at: Date
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string
}

export interface SearchCriteria {
  searchTerm?: string
  status?: string
  priority?: string
  assignedTo?: string
  createdBy?: string
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface ISampleService {
  createSample(data: CreateSampleData): Promise<Sample>
  updateSample(id: string, data: UpdateSampleData): Promise<Sample>
  getSampleById(id: string): Promise<Sample | null>
  getAllSamples(): Promise<Sample[]>
  searchSamples(criteria: SearchCriteria): Promise<Sample[]>
  deleteSample(id: string): Promise<{ success: boolean }>
  assignSample(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample>
  updateSampleStatus(id: string, status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'): Promise<Sample>
  getSamplesByStatus(status: string): Promise<Sample[]>
  getSamplesByUser(userId: string): Promise<Sample[]>
} 