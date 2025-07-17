# Sample Status Update Issue - Fix Summary

## Problem Identified
The sample status wasn't updating in the UI after mutations (status changes, assignments, etc.) due to several issues:

1. **Data Structure Inconsistency**: The UI was inconsistently using snake_case (from database) and camelCase field names
2. **Cache Invalidation Issues**: React Query cache wasn't being properly invalidated after mutations
3. **Stale Data**: tRPC queries were serving cached data instead of fresh data after updates

## Root Cause Analysis

### Data Structure Issue
- Database returns fields in snake_case: `assigned_to`, `library_prep_by`, `sample_name`, etc.
- TypeScript interfaces expected camelCase: `assignedTo`, `libraryPrepBy`, `sampleName`
- UI was inconsistently accessing both formats, leading to missed updates

### Cache Management Issue
- React Query `staleTime` was set to 5 seconds, causing stale data to be served
- No proper cache invalidation after mutations
- `refetch()` alone wasn't sufficient to force UI updates

## Fixes Implemented

### 1. Consistent Field Name Usage
**File**: `src/components/nanopore/nanopore-dashboard.tsx`
- Fixed UI to consistently use snake_case field names from database
- Added display of `library_prep_by` field that was missing
- Ensured all sample property access uses correct field names

### 2. Enhanced Cache Invalidation
**Files**: 
- `src/components/nanopore/nanopore-dashboard.tsx`
- `src/components/providers/trpc-provider.tsx`

**Changes**:
- Added `useQueryClient` hook for manual cache invalidation
- Updated all mutation handlers to use `queryClient.invalidateQueries()`
- Set `staleTime: 0` to always fetch fresh data
- Added proper error handling and debugging logs

### 3. Improved Debugging
Added comprehensive logging to track:
- Mutation initiation with current vs new values
- Mutation results
- Cache invalidation and refetch operations
- Current assignment state before/after changes

### 4. React Query Configuration
**File**: `src/components/providers/trpc-provider.tsx`
- Set `staleTime: 0` to always refetch data
- Set `gcTime: 5 minutes` for cache retention
- Enabled `refetchOnWindowFocus` and `refetchOnReconnect`

## Updated Mutation Handlers

### Status Update Handler
```typescript
const handleStatusUpdate = async (sample: any, newStatus: string) => {
  console.log('Status update initiated:', { sampleId: sample.id, currentStatus: sample.status, newStatus })
  
  setActionLoading(sample.id)
  try {
    const result = await updateStatusMutation.mutateAsync({
      id: sample.id,
      status: newStatus,
    })
    
    console.log('Status update result:', result)
    
    // Invalidate and refetch the samples query
    await queryClient.invalidateQueries({ queryKey: ['nanopore', 'getAll'] })
    await refetch()
    
    console.log('Data refetched after status update')
    
    toast.success(`Sample status updated to ${newStatus}`)
  } catch (error) {
    console.error('Failed to update status:', error)
    toast.error('Failed to update sample status')
  } finally {
    setActionLoading(null)
  }
}
```

### Assignment Handler
```typescript
const handleSampleAssign = async (assignedTo: string, libraryPrepBy?: string) => {
  if (!selectedSample) return
  
  console.log('Sample assignment initiated:', { 
    sampleId: selectedSample.id, 
    assignedTo, 
    libraryPrepBy,
    currentAssignedTo: selectedSample.assigned_to,
    currentLibraryPrepBy: selectedSample.library_prep_by
  })
  
  setActionLoading(selectedSample.id)
  try {
    const result = await assignSampleMutation.mutateAsync({
      id: selectedSample.id,
      assignedTo,
      libraryPrepBy,
    })
    
    console.log('Assignment result:', result)
    
    // Invalidate and refetch the samples query
    await queryClient.invalidateQueries({ queryKey: ['nanopore', 'getAll'] })
    await refetch()
    
    console.log('Data refetched after assignment')
    
    toast.success('Sample assigned successfully')
    setShowAssignModal(false)
  } catch (error) {
    console.error('Failed to assign sample:', error)
    toast.error('Failed to assign sample')
  } finally {
    setActionLoading(null)
  }
}
```

## Testing Instructions

### 1. Browser Console Debugging
Open browser dev tools and watch the console while:
1. Updating sample status
2. Assigning samples
3. Editing sample details

Look for logs showing:
- Mutation initiation with current/new values
- Mutation results
- Cache invalidation and refetch confirmation

### 2. UI Verification
After each mutation:
1. Status badges should update immediately
2. Assignment information should appear/update
3. No page refresh should be needed
4. Changes should persist after page refresh

### 3. Network Tab Monitoring
In browser dev tools Network tab:
1. Watch for tRPC calls after mutations
2. Verify fresh data is being fetched (not from cache)
3. Check response data contains updated values

## Expected Behavior

### Before Fix
- Status updates would succeed in database but UI wouldn't reflect changes
- Assignment changes wouldn't show in UI immediately
- Required page refresh to see updates
- Inconsistent field access causing undefined values

### After Fix
- Immediate UI updates after all mutations
- Consistent field name usage throughout UI
- Proper cache invalidation ensuring fresh data
- Comprehensive debugging for troubleshooting
- No page refresh needed to see changes

## Additional Improvements

### Field Name Consistency
Consider creating a data transformation layer to convert between snake_case (database) and camelCase (UI) for better type safety.

### Optimistic Updates
Could implement optimistic updates for better UX while mutations are in progress.

### Real-time Updates
Consider adding WebSocket or Server-Sent Events for real-time updates across multiple users.

## Files Modified
1. `src/components/nanopore/nanopore-dashboard.tsx` - Main dashboard component with mutation handlers
2. `src/components/providers/trpc-provider.tsx` - React Query configuration
3. `STATUS_UPDATE_FIX_SUMMARY.md` - This documentation

## Verification Checklist
- [ ] Status updates reflect immediately in UI
- [ ] Assignment changes show immediately
- [ ] Console logs show mutation flow
- [ ] No TypeScript errors
- [ ] Build completes successfully
- [ ] Network requests show fresh data fetching
- [ ] Changes persist after page refresh 