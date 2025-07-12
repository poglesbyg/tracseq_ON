import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'

// Theme and appearance preferences
export interface ThemePreferences {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  fontSize: 'sm' | 'md' | 'lg'
  compactMode: boolean
  animations: boolean
}

// CRISPR-specific preferences
export interface CrisprPreferences {
  defaultPamType: 'NGG' | 'NRG' | 'NNGRRT'
  defaultMinEfficiency: number
  defaultMaxOffTargets: number
  autoAnalyze: boolean
  showAdvancedOptions: boolean
  preferredGenomeBuild: 'hg38' | 'hg19' | 'mm10' | 'mm39'
  maxGuidesDisplay: number
}

// Analysis preferences
export interface AnalysisPreferences {
  autoSaveResults: boolean
  enableNotifications: boolean
  defaultAnalysisTimeout: number
  showProgressDetails: boolean
  exportFormat: 'json' | 'csv' | 'excel'
  includeMetadata: boolean
}

// Interface preferences
export interface InterfacePreferences {
  sidebarPosition: 'left' | 'right'
  showTooltips: boolean
  keyboardShortcuts: boolean
  autoCollapseSections: boolean
  defaultView: 'grid' | 'list' | 'table'
  itemsPerPage: number
}

// Performance preferences
export interface PerformancePreferences {
  enableCaching: boolean
  maxCacheSize: number
  enableRealTimeUpdates: boolean
  updateInterval: number
  enableBackgroundSync: boolean
  maxConcurrentOperations: number
}

// Complete preferences state
export interface UserPreferences {
  theme: ThemePreferences
  crispr: CrisprPreferences
  analysis: AnalysisPreferences
  interface: InterfacePreferences
  performance: PerformancePreferences
  lastUpdated: Date
}

// Action types
export type UserPreferencesAction =
  | { type: 'UPDATE_THEME'; payload: Partial<ThemePreferences> }
  | { type: 'UPDATE_CRISPR'; payload: Partial<CrisprPreferences> }
  | { type: 'UPDATE_ANALYSIS'; payload: Partial<AnalysisPreferences> }
  | { type: 'UPDATE_INTERFACE'; payload: Partial<InterfacePreferences> }
  | { type: 'UPDATE_PERFORMANCE'; payload: Partial<PerformancePreferences> }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'LOAD_PREFERENCES'; payload: UserPreferences }
  | { type: 'EXPORT_PREFERENCES' }
  | { type: 'IMPORT_PREFERENCES'; payload: Partial<UserPreferences> }

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: {
    mode: 'system',
    primaryColor: '#2563eb',
    fontSize: 'md',
    compactMode: false,
    animations: true,
  },
  crispr: {
    defaultPamType: 'NGG',
    defaultMinEfficiency: 0.3,
    defaultMaxOffTargets: 5,
    autoAnalyze: true,
    showAdvancedOptions: false,
    preferredGenomeBuild: 'hg38',
    maxGuidesDisplay: 20,
  },
  analysis: {
    autoSaveResults: true,
    enableNotifications: true,
    defaultAnalysisTimeout: 300, // 5 minutes
    showProgressDetails: true,
    exportFormat: 'json',
    includeMetadata: true,
  },
  interface: {
    sidebarPosition: 'left',
    showTooltips: true,
    keyboardShortcuts: true,
    autoCollapseSections: false,
    defaultView: 'grid',
    itemsPerPage: 20,
  },
  performance: {
    enableCaching: true,
    maxCacheSize: 100, // MB
    enableRealTimeUpdates: true,
    updateInterval: 5000, // ms
    enableBackgroundSync: true,
    maxConcurrentOperations: 3,
  },
  lastUpdated: new Date(),
}

// Reducer
function userPreferencesReducer(
  state: UserPreferences,
  action: UserPreferencesAction
): UserPreferences {
  switch (action.type) {
    case 'UPDATE_THEME':
      return {
        ...state,
        theme: { ...state.theme, ...action.payload },
        lastUpdated: new Date(),
      }

    case 'UPDATE_CRISPR':
      return {
        ...state,
        crispr: { ...state.crispr, ...action.payload },
        lastUpdated: new Date(),
      }

    case 'UPDATE_ANALYSIS':
      return {
        ...state,
        analysis: { ...state.analysis, ...action.payload },
        lastUpdated: new Date(),
      }

    case 'UPDATE_INTERFACE':
      return {
        ...state,
        interface: { ...state.interface, ...action.payload },
        lastUpdated: new Date(),
      }

    case 'UPDATE_PERFORMANCE':
      return {
        ...state,
        performance: { ...state.performance, ...action.payload },
        lastUpdated: new Date(),
      }

    case 'RESET_TO_DEFAULTS':
      return {
        ...defaultPreferences,
        lastUpdated: new Date(),
      }

    case 'LOAD_PREFERENCES':
      return {
        ...action.payload,
        lastUpdated: new Date(),
      }

    case 'IMPORT_PREFERENCES':
      return {
        ...state,
        ...action.payload,
        lastUpdated: new Date(),
      }

    default:
      return state
  }
}

// Storage utilities
const STORAGE_KEY = 'tracseq-user-preferences'

function loadPreferencesFromStorage(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...defaultPreferences,
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated || Date.now()),
      }
    }
  } catch (error) {
    console.warn('Failed to load preferences from storage:', error)
  }
  return defaultPreferences
}

function savePreferencesToStorage(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.warn('Failed to save preferences to storage:', error)
  }
}

// Context
const UserPreferencesContext = createContext<{
  preferences: UserPreferences
  dispatch: React.Dispatch<UserPreferencesAction>
} | null>(null)

// Provider component
export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, dispatch] = useReducer(
    userPreferencesReducer,
    defaultPreferences,
    loadPreferencesFromStorage
  )

  // Auto-save to localStorage whenever preferences change
  useEffect(() => {
    savePreferencesToStorage(preferences)
  }, [preferences])

  // Apply theme changes to document
  useEffect(() => {
    const { mode, primaryColor, fontSize, compactMode } = preferences.theme

    // Apply theme mode
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else if (mode === 'light') {
      root.classList.remove('dark')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    // Apply primary color
    root.style.setProperty('--primary-color', primaryColor)

    // Apply font size
    root.classList.remove('text-sm', 'text-base', 'text-lg')
    switch (fontSize) {
      case 'sm':
        root.classList.add('text-sm')
        break
      case 'lg':
        root.classList.add('text-lg')
        break
      default:
        root.classList.add('text-base')
    }

    // Apply compact mode
    if (compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
  }, [preferences.theme])

  return (
    <UserPreferencesContext.Provider value={{ preferences, dispatch }}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

// Hook to use the context
export function useUserPreferences() {
  const context = useContext(UserPreferencesContext)
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return context
}

// Specific preference hooks
export function useThemePreferences() {
  const { preferences, dispatch } = useUserPreferences()
  return {
    theme: preferences.theme,
    updateTheme: (updates: Partial<ThemePreferences>) =>
      dispatch({ type: 'UPDATE_THEME', payload: updates }),
  }
}

export function useCrisprPreferences() {
  const { preferences, dispatch } = useUserPreferences()
  return {
    crispr: preferences.crispr,
    updateCrispr: (updates: Partial<CrisprPreferences>) =>
      dispatch({ type: 'UPDATE_CRISPR', payload: updates }),
  }
}

export function useAnalysisPreferences() {
  const { preferences, dispatch } = useUserPreferences()
  return {
    analysis: preferences.analysis,
    updateAnalysis: (updates: Partial<AnalysisPreferences>) =>
      dispatch({ type: 'UPDATE_ANALYSIS', payload: updates }),
  }
}

export function useInterfacePreferences() {
  const { preferences, dispatch } = useUserPreferences()
  return {
    interface: preferences.interface,
    updateInterface: (updates: Partial<InterfacePreferences>) =>
      dispatch({ type: 'UPDATE_INTERFACE', payload: updates }),
  }
}

export function usePerformancePreferences() {
  const { preferences, dispatch } = useUserPreferences()
  return {
    performance: preferences.performance,
    updatePerformance: (updates: Partial<PerformancePreferences>) =>
      dispatch({ type: 'UPDATE_PERFORMANCE', payload: updates }),
  }
}

// Utility hooks
export function usePreferencesActions() {
  const { dispatch } = useUserPreferences()

  return {
    resetToDefaults: () => dispatch({ type: 'RESET_TO_DEFAULTS' }),
    
    exportPreferences: (preferences: UserPreferences) => {
      const dataStr = JSON.stringify(preferences, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tracseq-preferences.json'
      link.click()
      URL.revokeObjectURL(url)
    },

    importPreferences: (file: File) => {
      const reader = new FileReader()
      reader.addEventListener('load', (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)
          dispatch({ type: 'IMPORT_PREFERENCES', payload: imported })
        } catch (error) {
          console.error('Failed to import preferences:', error)
        }
      })
      reader.readAsText(file)
    },
  }
}

// Keyboard shortcut hook
export function useKeyboardShortcuts() {
  const { preferences } = useUserPreferences()

  useEffect(() => {
    if (!preferences.interface.keyboardShortcuts) {return}

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        // Trigger search modal
        console.log('Search shortcut triggered')
      }

      // Ctrl/Cmd + , for preferences
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        // Trigger preferences modal
        console.log('Preferences shortcut triggered')
      }

      // Ctrl/Cmd + Shift + D for toggle dark mode
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        // Toggle dark mode
        console.log('Dark mode toggle shortcut triggered')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [preferences.interface.keyboardShortcuts])
}

// Theme system detection hook
export function useSystemTheme() {
  const { updateTheme } = useThemePreferences()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (_e: MediaQueryListEvent) => {
      // This will trigger the theme application in the provider
      updateTheme({ mode: 'system' })
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [updateTheme])
} 