import { z } from 'zod'

// Sample status enum
export enum SampleStatus {
  SUBMITTED = 'submitted',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Sample priority enum
export enum SamplePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Sample type enum
export enum SampleType {
  DNA = 'dna',
  RNA = 'rna',
  PROTEIN = 'protein',
  OTHER = 'other'
}

// Flow cell type enum
export enum FlowCellType {
  FLO_MIN106 = 'FLO-MIN106',
  FLO_MIN107 = 'FLO-MIN107',
  FLO_MIN108 = 'FLO-MIN108',
  FLO_MIN109 = 'FLO-MIN109',
  FLO_MIN110 = 'FLO-MIN110',
  FLO_MIN111 = 'FLO-MIN111',
  FLO_MIN112 = 'FLO-MIN112',
  FLO_MIN113 = 'FLO-MIN113',
  FLO_MIN114 = 'FLO-MIN114',
  FLO_MIN115 = 'FLO-MIN115',
  FLO_MIN116 = 'FLO-MIN116',
  FLO_MIN117 = 'FLO-MIN117',
  FLO_MIN118 = 'FLO-MIN118',
  FLO_MIN119 = 'FLO-MIN119',
  FLO_MIN120 = 'FLO-MIN120',
  FLO_MIN121 = 'FLO-MIN121',
  FLO_MIN122 = 'FLO-MIN122',
  FLO_MIN123 = 'FLO-MIN123',
  FLO_MIN124 = 'FLO-MIN124',
  FLO_MIN125 = 'FLO-MIN125',
  FLO_MIN126 = 'FLO-MIN126',
  FLO_MIN127 = 'FLO-MIN127',
  FLO_MIN128 = 'FLO-MIN128',
  FLO_MIN129 = 'FLO-MIN129',
  FLO_MIN130 = 'FLO-MIN130',
  FLO_MIN131 = 'FLO-MIN131',
  FLO_MIN132 = 'FLO-MIN132',
  FLO_MIN133 = 'FLO-MIN133',
  FLO_MIN134 = 'FLO-MIN134',
  FLO_MIN135 = 'FLO-MIN135',
  FLO_MIN136 = 'FLO-MIN136',
  FLO_MIN137 = 'FLO-MIN137',
  FLO_MIN138 = 'FLO-MIN138',
  FLO_MIN139 = 'FLO-MIN139',
  FLO_MIN140 = 'FLO-MIN140',
  FLO_MIN141 = 'FLO-MIN141',
  FLO_MIN142 = 'FLO-MIN142',
  FLO_MIN143 = 'FLO-MIN143',
  FLO_MIN144 = 'FLO-MIN144',
  FLO_MIN145 = 'FLO-MIN145',
  FLO_MIN146 = 'FLO-MIN146',
  FLO_MIN147 = 'FLO-MIN147',
  FLO_MIN148 = 'FLO-MIN148',
  FLO_MIN149 = 'FLO-MIN149',
  FLO_MIN150 = 'FLO-MIN150',
  FLO_MIN151 = 'FLO-MIN151',
  FLO_MIN152 = 'FLO-MIN152',
  FLO_MIN153 = 'FLO-MIN153',
  FLO_MIN154 = 'FLO-MIN154',
  FLO_MIN155 = 'FLO-MIN155',
  FLO_MIN156 = 'FLO-MIN156',
  FLO_MIN157 = 'FLO-MIN157',
  FLO_MIN158 = 'FLO-MIN158',
  FLO_MIN159 = 'FLO-MIN159',
  FLO_MIN160 = 'FLO-MIN160',
  FLO_MIN161 = 'FLO-MIN161',
  FLO_MIN162 = 'FLO-MIN162',
  FLO_MIN163 = 'FLO-MIN163',
  FLO_MIN164 = 'FLO-MIN164',
  FLO_MIN165 = 'FLO-MIN165',
  FLO_MIN166 = 'FLO-MIN166',
  FLO_MIN167 = 'FLO-MIN167',
  FLO_MIN168 = 'FLO-MIN168',
  FLO_MIN169 = 'FLO-MIN169',
  FLO_MIN170 = 'FLO-MIN170',
  FLO_MIN171 = 'FLO-MIN171',
  FLO_MIN172 = 'FLO-MIN172',
  FLO_MIN173 = 'FLO-MIN173',
  FLO_MIN174 = 'FLO-MIN174',
  FLO_MIN175 = 'FLO-MIN175',
  FLO_MIN176 = 'FLO-MIN176',
  FLO_MIN177 = 'FLO-MIN177',
  FLO_MIN178 = 'FLO-MIN178',
  FLO_MIN179 = 'FLO-MIN179',
  FLO_MIN180 = 'FLO-MIN180',
  FLO_MIN181 = 'FLO-MIN181',
  FLO_MIN182 = 'FLO-MIN182',
  FLO_MIN183 = 'FLO-MIN183',
  FLO_MIN184 = 'FLO-MIN184',
  FLO_MIN185 = 'FLO-MIN185',
  FLO_MIN186 = 'FLO-MIN186',
  FLO_MIN187 = 'FLO-MIN187',
  FLO_MIN188 = 'FLO-MIN188',
  FLO_MIN189 = 'FLO-MIN189',
  FLO_MIN190 = 'FLO-MIN190',
  FLO_MIN191 = 'FLO-MIN191',
  FLO_MIN192 = 'FLO-MIN192',
  FLO_MIN193 = 'FLO-MIN193',
  FLO_MIN194 = 'FLO-MIN194',
  FLO_MIN195 = 'FLO-MIN195',
  FLO_MIN196 = 'FLO-MIN196',
  FLO_MIN197 = 'FLO-MIN197',
  FLO_MIN198 = 'FLO-MIN198',
  FLO_MIN199 = 'FLO-MIN199',
  FLO_MIN200 = 'FLO-MIN200',
  FLO_MIN201 = 'FLO-MIN201',
  FLO_MIN202 = 'FLO-MIN202',
  FLO_MIN203 = 'FLO-MIN203',
  FLO_MIN204 = 'FLO-MIN204',
  FLO_MIN205 = 'FLO-MIN205',
  FLO_MIN206 = 'FLO-MIN206',
  FLO_MIN207 = 'FLO-MIN207',
  FLO_MIN208 = 'FLO-MIN208',
  FLO_MIN209 = 'FLO-MIN209',
  FLO_MIN210 = 'FLO-MIN210',
  FLO_MIN211 = 'FLO-MIN211',
  FLO_MIN212 = 'FLO-MIN212',
  FLO_MIN213 = 'FLO-MIN213',
  FLO_MIN214 = 'FLO-MIN214',
  FLO_MIN215 = 'FLO-MIN215',
  FLO_MIN216 = 'FLO-MIN216',
  FLO_MIN217 = 'FLO-MIN217',
  FLO_MIN218 = 'FLO-MIN218',
  FLO_MIN219 = 'FLO-MIN219',
  FLO_MIN220 = 'FLO-MIN220',
  FLO_MIN221 = 'FLO-MIN221',
  FLO_MIN222 = 'FLO-MIN222',
  FLO_MIN223 = 'FLO-MIN223',
  FLO_MIN224 = 'FLO-MIN224',
  FLO_MIN225 = 'FLO-MIN225',
  FLO_MIN226 = 'FLO-MIN226',
  FLO_MIN227 = 'FLO-MIN227',
  FLO_MIN228 = 'FLO-MIN228',
  FLO_MIN229 = 'FLO-MIN229',
  FLO_MIN230 = 'FLO-MIN230',
  FLO_MIN231 = 'FLO-MIN231',
  FLO_MIN232 = 'FLO-MIN232',
  FLO_MIN233 = 'FLO-MIN233',
  FLO_MIN234 = 'FLO-MIN234',
  FLO_MIN235 = 'FLO-MIN235',
  FLO_MIN236 = 'FLO-MIN236',
  FLO_MIN237 = 'FLO-MIN237',
  FLO_MIN238 = 'FLO-MIN238',
  FLO_MIN239 = 'FLO-MIN239',
  FLO_MIN240 = 'FLO-MIN240',
  FLO_MIN241 = 'FLO-MIN241',
  FLO_MIN242 = 'FLO-MIN242',
  FLO_MIN243 = 'FLO-MIN243',
  FLO_MIN244 = 'FLO-MIN244',
  FLO_MIN245 = 'FLO-MIN245',
  FLO_MIN246 = 'FLO-MIN246',
  FLO_MIN247 = 'FLO-MIN247',
  FLO_MIN248 = 'FLO-MIN248',
  FLO_MIN249 = 'FLO-MIN249',
  FLO_MIN250 = 'FLO-MIN250',
  FLO_MIN251 = 'FLO-MIN251',
  FLO_MIN252 = 'FLO-MIN252',
  FLO_MIN253 = 'FLO-MIN253',
  FLO_MIN254 = 'FLO-MIN254',
  FLO_MIN255 = 'FLO-MIN255',
  FLO_MIN256 = 'FLO-MIN256',
  FLO_MIN257 = 'FLO-MIN257',
  FLO_MIN258 = 'FLO-MIN258',
  FLO_MIN259 = 'FLO-MIN259',
  FLO_MIN260 = 'FLO-MIN260',
  FLO_MIN261 = 'FLO-MIN261',
  FLO_MIN262 = 'FLO-MIN262',
  FLO_MIN263 = 'FLO-MIN263',
  FLO_MIN264 = 'FLO-MIN264',
  FLO_MIN265 = 'FLO-MIN265',
  FLO_MIN266 = 'FLO-MIN266',
  FLO_MIN267 = 'FLO-MIN267',
  FLO_MIN268 = 'FLO-MIN268',
  FLO_MIN269 = 'FLO-MIN269',
  FLO_MIN270 = 'FLO-MIN270',
  FLO_MIN271 = 'FLO-MIN271',
  FLO_MIN272 = 'FLO-MIN272',
  FLO_MIN273 = 'FLO-MIN273',
  FLO_MIN274 = 'FLO-MIN274',
  FLO_MIN275 = 'FLO-MIN275',
  FLO_MIN276 = 'FLO-MIN276',
  FLO_MIN277 = 'FLO-MIN277',
  FLO_MIN278 = 'FLO-MIN278',
  FLO_MIN279 = 'FLO-MIN279',
  FLO_MIN280 = 'FLO-MIN280',
  FLO_MIN281 = 'FLO-MIN281',
  FLO_MIN282 = 'FLO-MIN282',
  FLO_MIN283 = 'FLO-MIN283',
  FLO_MIN284 = 'FLO-MIN284',
  FLO_MIN285 = 'FLO-MIN285',
  FLO_MIN286 = 'FLO-MIN286',
  FLO_MIN287 = 'FLO-MIN287',
  FLO_MIN288 = 'FLO-MIN288',
  FLO_MIN289 = 'FLO-MIN289',
  FLO_MIN290 = 'FLO-MIN290',
  FLO_MIN291 = 'FLO-MIN291',
  FLO_MIN292 = 'FLO-MIN292',
  FLO_MIN293 = 'FLO-MIN293',
  FLO_MIN294 = 'FLO-MIN294',
  FLO_MIN295 = 'FLO-MIN295',
  FLO_MIN296 = 'FLO-MIN296',
  FLO_MIN297 = 'FLO-MIN297',
  FLO_MIN298 = 'FLO-MIN298',
  FLO_MIN299 = 'FLO-MIN299',
  FLO_MIN300 = 'FLO-MIN300'
}

// Sample interface
export interface Sample {
  id: string
  sampleName: string
  projectId: string
  submitterName: string
  submitterEmail: string
  labName: string
  sampleType: SampleType
  sampleBuffer: string
  concentration: number
  volume: number
  totalAmount: number
  flowCellType: FlowCellType
  flowCellCount: number
  status: SampleStatus
  priority: SamplePriority
  assignedTo?: string
  libraryPrepBy?: string
  chartField: string
  createdAt: Date
  updatedAt: Date
}

// Create sample input
export interface CreateSampleInput {
  sampleName: string
  projectId: string
  submitterName: string
  submitterEmail: string
  labName: string
  sampleType: SampleType
  sampleBuffer: string
  concentration: number
  volume: number
  totalAmount: number
  flowCellType: FlowCellType
  flowCellCount: number
  priority: SamplePriority
  assignedTo?: string
  libraryPrepBy?: string
  chartField: string
}

// Update sample input
export interface UpdateSampleInput {
  sampleName?: string
  projectId?: string
  submitterName?: string
  submitterEmail?: string
  labName?: string
  sampleType?: SampleType
  sampleBuffer?: string
  concentration?: number
  volume?: number
  totalAmount?: number
  flowCellType?: FlowCellType
  flowCellCount?: number
  status?: SampleStatus
  priority?: SamplePriority
  assignedTo?: string
  libraryPrepBy?: string
}

// Sample search filters
export interface SampleFilters {
  status?: SampleStatus[]
  priority?: SamplePriority[]
  assignedTo?: string
  submitterEmail?: string
  labName?: string
  sampleType?: SampleType[]
  flowCellType?: FlowCellType[]
  chartField?: string
  dateFrom?: Date
  dateTo?: Date
}

// Sample search result
export interface SampleSearchResult {
  samples: Sample[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Zod schemas for validation
export const createSampleSchema = z.object({
  sampleName: z.string().min(1, 'Sample name is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  submitterName: z.string().min(1, 'Submitter name is required'),
  submitterEmail: z.string().email('Invalid email address'),
  labName: z.string().min(1, 'Lab name is required'),
  sampleType: z.nativeEnum(SampleType),
  sampleBuffer: z.string().min(1, 'Sample buffer is required'),
  concentration: z.number().positive('Concentration must be positive'),
  volume: z.number().positive('Volume must be positive'),
  totalAmount: z.number().positive('Total amount must be positive'),
  flowCellType: z.nativeEnum(FlowCellType),
  flowCellCount: z.number().int().positive('Flow cell count must be a positive integer'),
  priority: z.nativeEnum(SamplePriority),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional(),
  chartField: z.string().min(1, 'Chart field is required')
})

export const updateSampleSchema = z.object({
  sampleName: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  submitterName: z.string().min(1).optional(),
  submitterEmail: z.string().email().optional(),
  labName: z.string().min(1).optional(),
  sampleType: z.nativeEnum(SampleType).optional(),
  sampleBuffer: z.string().min(1).optional(),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
  flowCellType: z.nativeEnum(FlowCellType).optional(),
  flowCellCount: z.number().int().positive().optional(),
  status: z.nativeEnum(SampleStatus).optional(),
  priority: z.nativeEnum(SamplePriority).optional(),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional()
})

export const sampleFiltersSchema = z.object({
  status: z.array(z.nativeEnum(SampleStatus)).optional(),
  priority: z.array(z.nativeEnum(SamplePriority)).optional(),
  assignedTo: z.string().optional(),
  submitterEmail: z.string().optional(),
  labName: z.string().optional(),
  sampleType: z.array(z.nativeEnum(SampleType)).optional(),
  flowCellType: z.array(z.nativeEnum(FlowCellType)).optional(),
  chartField: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
})

// Type exports
export type CreateSampleInputType = z.infer<typeof createSampleSchema>
export type UpdateSampleInputType = z.infer<typeof updateSampleSchema>
export type SampleFiltersType = z.infer<typeof sampleFiltersSchema>