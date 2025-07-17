import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import type { UserSession } from '../../lib/auth/AdminAuth'

interface Migration {
  id: string
  version: string
  name: string
  description: string
  filename: string
  author: string
  estimatedDuration: number
  requiresDowntime: boolean
  backupRequired: boolean
  tags: string[]
  dependencies: string[]
  createdAt?: Date
}

interface MigrationPlan {
  migrations: Migration[]
  direction: 'up' | 'down'
  targetVersion: string
  estimatedDuration: number
  requiresDowntime: boolean
  backupRequired: boolean
  warnings: string[]
}

interface MigrationResult {
  success: boolean
  migrationId: string
  version: string
  direction: 'up' | 'down'
  duration: number
  appliedAt: Date
  error?: string
  rollbackRequired: boolean
  affectedRows: number
  warnings: string[]
}

interface MigrationStats {
  totalMigrations: number
  appliedMigrations: number
  pendingMigrations: number
  failedMigrations: number
  lastMigration: string | null
  systemLocked: boolean
}

interface MigrationData {
  stats: MigrationStats
  history: any[]
  pending: Migration[]
  applied: Migration[]
  plan: MigrationPlan | null
  validation: { valid: boolean; issues: string[] } | null
  executionResults: MigrationResult[] | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface MigrationPanelProps {
  adminSession: UserSession | null
}

export function MigrationPanel({ adminSession }: MigrationPanelProps) {
  const [migrationData, setMigrationData] = useState<MigrationData>({
    stats: {
      totalMigrations: 0,
      appliedMigrations: 0,
      pendingMigrations: 0,
      failedMigrations: 0,
      lastMigration: null,
      systemLocked: false
    },
    history: [],
    pending: [],
    applied: [],
    plan: null,
    validation: null,
    executionResults: null,
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'applied' | 'history' | 'plan'>('overview')
  const [planConfig, setPlanConfig] = useState({
    targetVersion: '',
    direction: 'up' as 'up' | 'down',
    dryRun: true
  })
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationAction, setConfirmationAction] = useState<'execute' | 'rollback' | null>(null)
  const [executing, setExecuting] = useState(false)

  // Fetch migration data with authentication
  const fetchMigrationData = async () => {
    if (!adminSession) {
      setMigrationData(prev => ({ ...prev, error: 'Admin session required' }))
      return
    }

    setMigrationData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const [statsResponse, historyResponse, pendingResponse, appliedResponse, validationResponse] = await Promise.all([
        fetch('/api/migration?action=status', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/migration?action=history', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/migration?action=pending', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/migration?action=applied', {
          credentials: 'include' // Include cookies for session authentication
        }),
        fetch('/api/migration?action=validate', {
          credentials: 'include' // Include cookies for session authentication
        })
      ])

      // Check if all responses are okay
      const responses = [statsResponse, historyResponse, pendingResponse, appliedResponse, validationResponse]
      const failedResponse = responses.find(r => !r.ok)
      if (failedResponse) {
        throw new Error(`HTTP error! status: ${failedResponse.status}`)
      }

      const [statsData, historyData, pendingData, appliedData, validationData] = await Promise.all(
        responses.map(r => r.json())
      )

      // Check if all data is successful
      const allSuccessful = [statsData, historyData, pendingData, appliedData, validationData].every(d => d.success)
      if (!allSuccessful) {
        throw new Error('Failed to fetch migration data')
      }

      setMigrationData(prev => ({
        ...prev,
        stats: statsData.data,
        history: historyData.data,
        pending: pendingData.data,
        applied: appliedData.data,
        validation: validationData.data,
        loading: false,
        lastUpdated: new Date()
      }))
    } catch (error) {
      console.error('Error fetching migration data:', error)
      setMigrationData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch migration data' 
      }))
    }
  }

  // Create migration plan
  const createPlan = async () => {
    setMigrationData(prev => ({ ...prev, error: null }))
    
    try {
      const response = await fetch(`/api/migration?action=plan&version=${planConfig.targetVersion}&direction=${planConfig.direction}`, {
        credentials: 'include' // Include cookies for session authentication
      })
      const data = await response.json()
      
      if (data.success) {
        setMigrationData(prev => ({
          ...prev,
          plan: data.data
        }))
      } else {
        throw new Error(data.error || 'Failed to create migration plan')
      }
    } catch (error) {
      console.error('Error creating migration plan:', error)
      setMigrationData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create migration plan'
      }))
    }
  }

  // Execute migration plan
  const executePlan = async (dryRun: boolean = false) => {
    if (!migrationData.plan) return
    
    setExecuting(true)
    setMigrationData(prev => ({ ...prev, error: null }))
    
    try {
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'execute_plan',
          targetVersion: migrationData.plan.targetVersion,
          direction: migrationData.plan.direction,
          dryRun,
          force: false
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setMigrationData(prev => ({
          ...prev,
          executionResults: data.data.results
        }))
        
        // Refresh data after execution
        if (!dryRun) {
          await fetchMigrationData()
        }
      } else {
        throw new Error(data.error || 'Failed to execute migration plan')
      }
    } catch (error) {
      console.error('Error executing migration plan:', error)
      setMigrationData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to execute migration plan'
      }))
    } finally {
      setExecuting(false)
      setShowConfirmation(false)
    }
  }

  // Execute rollback
  const executeRollback = async () => {
    setExecuting(true)
    setMigrationData(prev => ({ ...prev, error: null }))
    
    try {
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'rollback',
          rollbackVersion: '', // No version specified for rollback
          rollbackForce: false
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setMigrationData(prev => ({
          ...prev,
          executionResults: data.data.results
        }))
        
        // Refresh data after rollback
        await fetchMigrationData()
      } else {
        throw new Error(data.error || 'Failed to execute rollback')
      }
    } catch (error) {
      console.error('Error executing rollback:', error)
      setMigrationData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to execute rollback'
      }))
    } finally {
      setExecuting(false)
      setShowConfirmation(false)
    }
  }

  // Auto-refresh data
  useEffect(() => {
    if (adminSession) {
      fetchMigrationData()
    }
    
    const interval = setInterval(() => {
      if (adminSession) {
        fetchMigrationData()
      }
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [adminSession])

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'running': return 'bg-yellow-500'
      case 'failed': return 'bg-red-500'
      case 'pending': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Database Migration Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchMigrationData}
            disabled={migrationData.loading}
          >
            {migrationData.loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setActiveTab('plan')}
            disabled={migrationData.stats.systemLocked}
          >
            Create Plan
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {migrationData.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>Error:</strong> {migrationData.error}
          </div>
        </Card>
      )}

      {/* System Status */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <div className="text-sm text-gray-600">Total Migrations</div>
            <div className="text-xl font-bold">{migrationData.stats.totalMigrations}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Applied</div>
            <div className="text-xl font-bold text-green-600">{migrationData.stats.appliedMigrations}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-xl font-bold text-yellow-600">{migrationData.stats.pendingMigrations}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-xl font-bold text-red-600">{migrationData.stats.failedMigrations}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Last Migration</div>
            <div className="text-sm font-medium">{migrationData.stats.lastMigration || 'None'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">System Status</div>
            <Badge variant={migrationData.stats.systemLocked ? 'destructive' : 'default'}>
              {migrationData.stats.systemLocked ? 'Locked' : 'Ready'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Validation Status */}
      {migrationData.validation && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Validation Status</h3>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant={migrationData.validation.valid ? 'default' : 'destructive'}>
              {migrationData.validation.valid ? 'Valid' : 'Issues Found'}
            </Badge>
            {migrationData.validation.issues.length > 0 && (
              <span className="text-sm text-gray-600">
                {migrationData.validation.issues.length} issue(s)
              </span>
            )}
          </div>
          {migrationData.validation.issues.length > 0 && (
            <div className="space-y-1">
              {migrationData.validation.issues.map((issue, index) => (
                <div key={index} className="text-sm text-red-600">
                  • {issue}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        {['overview', 'pending', 'applied', 'history', 'plan'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Migration Overview</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div><strong>Database migrations</strong> allow you to version control your database schema changes.</div>
                <div><strong>Rollback capabilities</strong> ensure you can safely revert changes if needed.</div>
                <div><strong>Dry run mode</strong> lets you test migrations without applying them.</div>
                <div><strong>Dependency tracking</strong> ensures migrations are applied in the correct order.</div>
              </div>
            </Card>
            
            {migrationData.stats.pendingMigrations > 0 && (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">Pending Migrations</h4>
                <div className="text-sm text-yellow-700 mb-3">
                  You have {migrationData.stats.pendingMigrations} pending migration(s) that need to be applied.
                </div>
                <Button 
                  onClick={() => setActiveTab('pending')}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  View Pending Migrations
                </Button>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Pending Migrations</h3>
            <div className="space-y-3">
              {migrationData.pending.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No pending migrations.
                </div>
              ) : (
                migrationData.pending.map((migration, _index) => (
                  <div key={migration.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono text-gray-500">
                        v{migration.version}
                      </div>
                      <div>
                        <div className="font-medium">{migration.name}</div>
                        <div className="text-sm text-gray-600">
                          {migration.description || 'No description'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Author: {migration.author} | Duration: {formatDuration(migration.estimatedDuration)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {migration.requiresDowntime && (
                        <Badge variant="destructive">Downtime</Badge>
                      )}
                      {migration.backupRequired && (
                        <Badge variant="secondary">Backup Required</Badge>
                      )}
                      {migration.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'applied' && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Applied Migrations</h3>
            <div className="space-y-3">
              {migrationData.applied.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No applied migrations.
                </div>
              ) : (
                migrationData.applied.map((migration, _index) => (
                  <div key={migration.id} className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono text-gray-500">
                        v{migration.version}
                      </div>
                      <div>
                        <div className="font-medium">{migration.name}</div>
                        <div className="text-sm text-gray-600">
                          {migration.description || 'No description'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Applied by: {migration.author} | {migration.createdAt ? new Date(migration.createdAt).toLocaleDateString() : 'Unknown date'}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">Applied</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Migration History</h3>
            <div className="space-y-3">
              {migrationData.history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No migration history.
                </div>
              ) : (
                migrationData.history.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(entry.status)}`} />
                      <div>
                        <div className="font-medium">v{entry.version} - {entry.name}</div>
                        <div className="text-sm text-gray-600">
                          {entry.direction === 'down' ? 'Rolled back' : 'Applied'} 
                          {entry.applied_at ? ` on ${new Date(entry.applied_at).toLocaleString()}` : ''}
                        </div>
                        {entry.error_message && (
                          <div className="text-sm text-red-600">
                            Error: {entry.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(entry.status)} text-white`}>
                        {entry.status}
                      </Badge>
                      {entry.duration && (
                        <div className="text-sm text-gray-500">
                          {formatDuration(entry.duration)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-4">
            {/* Plan Configuration */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Create Migration Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Version
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 003 (leave empty for latest)"
                    value={planConfig.targetVersion}
                    onChange={(e) => setPlanConfig(prev => ({ ...prev, targetVersion: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Direction
                  </label>
                  <select
                    value={planConfig.direction}
                    onChange={(e) => setPlanConfig(prev => ({ ...prev, direction: e.target.value as 'up' | 'down' }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="up">Up (Apply)</option>
                    <option value="down">Down (Rollback)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={createPlan} disabled={migrationData.stats.systemLocked}>
                    Create Plan
                  </Button>
                </div>
              </div>
            </Card>

            {/* Migration Plan Display */}
            {migrationData.plan && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-3">Migration Plan</h3>
                <div className="mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Direction</div>
                      <Badge variant={migrationData.plan?.direction === 'up' ? 'default' : 'destructive'}>
                        {migrationData.plan?.direction?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Target Version</div>
                      <div className="font-medium">{migrationData.plan?.targetVersion || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Migrations</div>
                      <div className="font-medium">{migrationData.plan?.migrations?.length || 0}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Estimated Duration</div>
                      <div className="font-medium">{formatDuration(migrationData.plan.estimatedDuration)}</div>
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {migrationData.plan.warnings.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="font-medium text-yellow-800 mb-2">Warnings:</div>
                    {migrationData.plan.warnings.map((warning, index) => (
                      <div key={index} className="text-sm text-yellow-700">
                        • {warning}
                      </div>
                    ))}
                  </div>
                )}

                {/* Migration List */}
                <div className="space-y-2 mb-4">
                  {migrationData.plan.migrations.map((migration, index) => (
                    <div key={migration.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-mono text-gray-500">
                          {index + 1}. v{migration.version}
                        </div>
                        <div className="font-medium">{migration.name}</div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDuration(migration.estimatedDuration)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Execution Buttons */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => executePlan(true)}
                    disabled={executing}
                    variant="outline"
                  >
                    {executing ? 'Executing...' : 'Dry Run'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setConfirmationAction('execute')
                      setShowConfirmation(true)
                    }}
                    disabled={executing || migrationData.plan.migrations.length === 0}
                    variant={migrationData.plan.direction === 'up' ? 'default' : 'destructive'}
                  >
                    {executing ? 'Executing...' : 'Execute Plan'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Execution Results */}
            {migrationData.executionResults && (
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-3">Execution Results</h3>
                <div className="space-y-2">
                  {migrationData.executionResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="font-medium">v{result.version} - {result.migrationId}</div>
                          <div className="text-sm text-gray-600">
                            {result.direction === 'up' ? 'Applied' : 'Rolled back'} in {formatDuration(result.duration)}
                          </div>
                          {result.error && (
                            <div className="text-sm text-red-600">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.success ? 'Success' : 'Failed'}
                        </Badge>
                        <div className="text-sm text-gray-500">
                          {result.affectedRows} rows
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <Card className="p-6 bg-red-50 border-red-200">
          <h3 className="text-lg font-semibold mb-3 text-red-800">
            ⚠️ Confirm Migration Action
          </h3>
          <div className="space-y-4 text-sm">
            <div className="text-red-700">
              <strong>WARNING:</strong> This action will modify your database schema.
            </div>
            <div className="text-gray-700">
              {confirmationAction === 'execute' && migrationData.plan && (
                <div>
                  <strong>You are about to {migrationData.plan.direction === 'up' ? 'apply' : 'rollback'} {migrationData.plan.migrations.length} migration(s):</strong>
                  <ul className="list-disc ml-5 mt-2">
                    {migrationData.plan.migrations.map(m => (
                      <li key={m.id}>v{m.version} - {m.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={() => confirmationAction === 'execute' ? executePlan(false) : executeRollback()}
                disabled={executing}
              >
                {executing ? 'Executing...' : 'Confirm'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowConfirmation(false)
                  setConfirmationAction(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Last Updated */}
      {migrationData.lastUpdated && (
        <div className="text-sm text-gray-600 text-center">
          Last updated: {migrationData.lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  )
} 