import { createContext, useContext, useReducer, type ReactNode } from 'react'

import type { OffTargetSite } from '../hooks/use-off-target-analysis'
import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'

// State interfaces
export interface CrisprProject {
  id: string
  name: string
  description?: string
  targetSequence: string
  parameters: DesignParameters
  guides: GuideRNA[]
  selectedGuides: string[]
  offTargetSites: Record<string, OffTargetSite[]>
  createdAt: Date
  updatedAt: Date
}

export interface CrisprState {
  // Current project
  currentProject: CrisprProject | null
  
  // All projects
  projects: CrisprProject[]
  
  // Global settings
  settings: {
    defaultParameters: DesignParameters
    autoSave: boolean
    maxGuides: number
    enableRealTimeUpdates: boolean
  }
  
  // UI state
  ui: {
    activeTab: 'design' | 'analysis' | 'batch' | 'ai' | 'results'
    sidebarOpen: boolean
    selectedGuideId: string | null
    analysisMode: 'off-target' | '3d-structure' | 'efficiency'
  }
  
  // Analysis state
  analysis: {
    isAnalyzing: boolean
    currentAnalysis: string | null
    results: Record<string, any>
  }
}

// Action types
export type CrisprAction =
  | { type: 'SET_CURRENT_PROJECT'; payload: CrisprProject | null }
  | { type: 'CREATE_PROJECT'; payload: Omit<CrisprProject, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<CrisprProject> } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'ADD_GUIDES'; payload: { projectId: string; guides: GuideRNA[] } }
  | { type: 'SELECT_GUIDES'; payload: { projectId: string; guideIds: string[] } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<CrisprState['settings']> }
  | { type: 'SET_ACTIVE_TAB'; payload: CrisprState['ui']['activeTab'] }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_SELECTED_GUIDE'; payload: string | null }
  | { type: 'SET_ANALYSIS_MODE'; payload: CrisprState['ui']['analysisMode'] }
  | { type: 'START_ANALYSIS'; payload: string }
  | { type: 'COMPLETE_ANALYSIS'; payload: { id: string; results: any } }
  | { type: 'ADD_OFF_TARGET_SITES'; payload: { guideId: string; sites: OffTargetSite[] } }

// Default state
const defaultParameters: DesignParameters = {
  targetSequence: '',
  pamType: 'NGG',
  minEfficiencyScore: 0.3,
  maxOffTargets: 5,
  allowNonCanonicalPAMs: false,
}

const initialState: CrisprState = {
  currentProject: null,
  projects: [],
  settings: {
    defaultParameters,
    autoSave: true,
    maxGuides: 20,
    enableRealTimeUpdates: true,
  },
  ui: {
    activeTab: 'design',
    sidebarOpen: true,
    selectedGuideId: null,
    analysisMode: 'off-target',
  },
  analysis: {
    isAnalyzing: false,
    currentAnalysis: null,
    results: {},
  },
}

// Reducer
function crisprReducer(state: CrisprState, action: CrisprAction): CrisprState {
  switch (action.type) {
    case 'SET_CURRENT_PROJECT':
      return {
        ...state,
        currentProject: action.payload,
      }

    case 'CREATE_PROJECT': {
      const newProject: CrisprProject = {
        ...action.payload,
        id: `project-${Date.now()}`,
        guides: [],
        selectedGuides: [],
        offTargetSites: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
      }
    }

    case 'UPDATE_PROJECT': {
      const updatedProjects = state.projects.map(project =>
        project.id === action.payload.id
          ? { ...project, ...action.payload.updates, updatedAt: new Date() }
          : project
      )
      return {
        ...state,
        projects: updatedProjects,
        currentProject: state.currentProject?.id === action.payload.id
          ? { ...state.currentProject, ...action.payload.updates, updatedAt: new Date() }
          : state.currentProject,
      }
    }

    case 'DELETE_PROJECT': {
      const filteredProjects = state.projects.filter(p => p.id !== action.payload)
      return {
        ...state,
        projects: filteredProjects,
        currentProject: state.currentProject?.id === action.payload ? null : state.currentProject,
      }
    }

    case 'ADD_GUIDES': {
      const updatedProjects = state.projects.map(project =>
        project.id === action.payload.projectId
          ? { ...project, guides: [...project.guides, ...action.payload.guides], updatedAt: new Date() }
          : project
      )
      return {
        ...state,
        projects: updatedProjects,
        currentProject: state.currentProject?.id === action.payload.projectId
          ? { ...state.currentProject, guides: [...state.currentProject.guides, ...action.payload.guides], updatedAt: new Date() }
          : state.currentProject,
      }
    }

    case 'SELECT_GUIDES': {
      const updatedProjects = state.projects.map(project =>
        project.id === action.payload.projectId
          ? { ...project, selectedGuides: action.payload.guideIds, updatedAt: new Date() }
          : project
      )
      return {
        ...state,
        projects: updatedProjects,
        currentProject: state.currentProject?.id === action.payload.projectId
          ? { ...state.currentProject, selectedGuides: action.payload.guideIds, updatedAt: new Date() }
          : state.currentProject,
      }
    }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        ui: { ...state.ui, activeTab: action.payload },
      }

    case 'SET_SIDEBAR_OPEN':
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: action.payload },
      }

    case 'SET_SELECTED_GUIDE':
      return {
        ...state,
        ui: { ...state.ui, selectedGuideId: action.payload },
      }

    case 'SET_ANALYSIS_MODE':
      return {
        ...state,
        ui: { ...state.ui, analysisMode: action.payload },
      }

    case 'START_ANALYSIS':
      return {
        ...state,
        analysis: {
          ...state.analysis,
          isAnalyzing: true,
          currentAnalysis: action.payload,
        },
      }

    case 'COMPLETE_ANALYSIS':
      return {
        ...state,
        analysis: {
          ...state.analysis,
          isAnalyzing: false,
          currentAnalysis: null,
          results: {
            ...state.analysis.results,
            [action.payload.id]: action.payload.results,
          },
        },
      }

    case 'ADD_OFF_TARGET_SITES': {
      const updatedProjects = state.projects.map(project =>
        project.id === state.currentProject?.id
          ? {
              ...project,
              offTargetSites: {
                ...project.offTargetSites,
                [action.payload.guideId]: action.payload.sites,
              },
              updatedAt: new Date(),
            }
          : project
      )
      return {
        ...state,
        projects: updatedProjects,
        currentProject: state.currentProject
          ? {
              ...state.currentProject,
              offTargetSites: {
                ...state.currentProject.offTargetSites,
                [action.payload.guideId]: action.payload.sites,
              },
              updatedAt: new Date(),
            }
          : null,
      }
    }

    default:
      return state
  }
}

// Context
const CrisprContext = createContext<{
  state: CrisprState
  dispatch: React.Dispatch<CrisprAction>
} | null>(null)

// Provider component
export function CrisprProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(crisprReducer, initialState)

  // Auto-save effect could be added here
  // useEffect(() => {
  //   if (state.settings.autoSave && state.currentProject) {
  //     // Save to localStorage or API
  //   }
  // }, [state.currentProject, state.settings.autoSave])

  return (
    <CrisprContext.Provider value={{ state, dispatch }}>
      {children}
    </CrisprContext.Provider>
  )
}

// Hook to use the context
export function useCrispr() {
  const context = useContext(CrisprContext)
  if (!context) {
    throw new Error('useCrispr must be used within a CrisprProvider')
  }
  return context
}

// Selector hooks for specific parts of state
export function useCrisprProjects() {
  const { state } = useCrispr()
  return state.projects
}

export function useCurrentProject() {
  const { state } = useCrispr()
  return state.currentProject
}

export function useCrisprSettings() {
  const { state, dispatch } = useCrispr()
  return {
    settings: state.settings,
    updateSettings: (updates: Partial<CrisprState['settings']>) =>
      dispatch({ type: 'UPDATE_SETTINGS', payload: updates }),
  }
}

export function useCrisprUI() {
  const { state, dispatch } = useCrispr()
  return {
    ui: state.ui,
    setActiveTab: (tab: CrisprState['ui']['activeTab']) =>
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    setSidebarOpen: (open: boolean) =>
      dispatch({ type: 'SET_SIDEBAR_OPEN', payload: open }),
    setSelectedGuide: (guideId: string | null) =>
      dispatch({ type: 'SET_SELECTED_GUIDE', payload: guideId }),
    setAnalysisMode: (mode: CrisprState['ui']['analysisMode']) =>
      dispatch({ type: 'SET_ANALYSIS_MODE', payload: mode }),
  }
}

export function useCrisprAnalysis() {
  const { state, dispatch } = useCrispr()
  return {
    analysis: state.analysis,
    startAnalysis: (id: string) =>
      dispatch({ type: 'START_ANALYSIS', payload: id }),
    completeAnalysis: (id: string, results: any) =>
      dispatch({ type: 'COMPLETE_ANALYSIS', payload: { id, results } }),
  }
}

// Action creators for complex operations
export function useCrisprActions() {
  const { dispatch } = useCrispr()

  return {
    createProject: (project: Omit<CrisprProject, 'id' | 'createdAt' | 'updatedAt'>) =>
      dispatch({ type: 'CREATE_PROJECT', payload: project }),

    updateProject: (id: string, updates: Partial<CrisprProject>) =>
      dispatch({ type: 'UPDATE_PROJECT', payload: { id, updates } }),

    deleteProject: (id: string) =>
      dispatch({ type: 'DELETE_PROJECT', payload: id }),

    setCurrentProject: (project: CrisprProject | null) =>
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: project }),

    addGuides: (projectId: string, guides: GuideRNA[]) =>
      dispatch({ type: 'ADD_GUIDES', payload: { projectId, guides } }),

    selectGuides: (projectId: string, guideIds: string[]) =>
      dispatch({ type: 'SELECT_GUIDES', payload: { projectId, guideIds } }),

    addOffTargetSites: (guideId: string, sites: OffTargetSite[]) =>
      dispatch({ type: 'ADD_OFF_TARGET_SITES', payload: { guideId, sites } }),
  }
} 