import { useCallback, useEffect, useState } from 'react'

import { config, env, configUtils, type AppConfig } from '../config/app-config'

export interface ConfigState {
  config: AppConfig
  env: typeof env
  isLoading: boolean
  error: string | null
}

export interface UseConfigOptions {
  refreshInterval?: number
  enableHotReload?: boolean
}

export function useConfig(options: UseConfigOptions = {}) {
  const { refreshInterval = 0, enableHotReload = false } = options
  
  const [state, setState] = useState<ConfigState>({
    config,
    env,
    isLoading: false,
    error: null,
  })

  // Refresh configuration (useful for development)
  const refreshConfig = useCallback(() => {
    if (!configUtils.isDevelopment()) {return}
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      // In development, we could potentially reload config from server
      // For now, we just use the current config
      setState(prev => ({
        ...prev,
        config,
        env,
        isLoading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to refresh config',
        isLoading: false,
      }))
    }
  }, [])

  // Set up hot reload in development
  useEffect(() => {
    if (!enableHotReload || !configUtils.isDevelopment()) {return}

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshConfig()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enableHotReload, refreshConfig])

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) {return}

    const interval = setInterval(refreshConfig, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval, refreshConfig])

  return {
    ...state,
    refreshConfig,
    utils: configUtils,
  }
}

// Specific hooks for different configuration sections
export function useAppInfo() {
  const { config } = useConfig()
  return config.app
}

export function useFeatures() {
  const { config } = useConfig()
  return config.features
}

export function usePerformanceConfig() {
  const { config } = useConfig()
  return config.performance
}

export function useUIConfig() {
  const { config } = useConfig()
  return config.ui
}

export function useAPIConfig() {
  const { config } = useConfig()
  return config.api
}

export function useSecurityConfig() {
  const { config } = useConfig()
  return config.security
}

// Feature flag hooks
export function useFeatureFlag(feature: keyof AppConfig['features']) {
  const { config } = useConfig()
  return config.features[feature].enabled
}

export function useCrisprConfig() {
  const { config } = useConfig()
  return config.features.crispr
}

export function useNanoporeConfig() {
  const { config } = useConfig()
  return config.features.nanopore
}

export function useAIConfig() {
  const { config } = useConfig()
  return config.features.ai
}

// Environment hooks
export function useEnvironment() {
  const { env } = useConfig()
  return env
}

export function useIsDevelopment() {
  return configUtils.isDevelopment()
}

export function useIsProduction() {
  return configUtils.isProduction()
}

export function useIsTest() {
  return configUtils.isTest()
}

// Debug hook
export function useDebugInfo() {
  const { utils } = useConfig()
  return utils.getDebugInfo()
} 