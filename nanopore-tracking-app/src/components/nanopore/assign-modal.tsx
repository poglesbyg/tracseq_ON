import { Users, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

interface AssignModalProps {
  isOpen: boolean
  onClose: () => void
  onAssign: (assignedTo: string, libraryPrepBy?: string) => void
  currentAssignment?: {
    assignedTo: string | null
    libraryPrepBy: string | null
  }
  sampleName: string
}

const STAFF_MEMBERS = [
  'Grey',
  'Tara', 
  'Stephanie',
  'Jenny',
  'Alex',
  'Sarah',
  'Michael',
  'Lisa'
]

export function AssignModal({
  isOpen,
  onClose,
  onAssign,
  currentAssignment,
  sampleName,
}: AssignModalProps) {
  const [assignedTo, setAssignedTo] = useState(currentAssignment?.assignedTo || '')
  const [libraryPrepBy, setLibraryPrepBy] = useState(currentAssignment?.libraryPrepBy || '')

  const handleAssign = () => {
    if (!assignedTo.trim()) {
      toast.error('Please select a staff member to assign the sample to')
      return
    }

    onAssign(assignedTo, libraryPrepBy || undefined)
    onClose()
    
    toast.success('Sample assigned successfully', {
      description: `${sampleName} has been assigned to ${assignedTo}${libraryPrepBy ? ` with library prep by ${libraryPrepBy}` : ''}`
    })
  }

  const handleClose = () => {
    setAssignedTo(currentAssignment?.assignedTo || '')
    setLibraryPrepBy(currentAssignment?.libraryPrepBy || '')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Sample
          </DialogTitle>
          <DialogDescription>
            Assign {sampleName} to a staff member and optionally specify who will handle library preparation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Assigned To *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_MEMBERS.map((member) => (
                <Button
                  key={member}
                  variant={assignedTo === member ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignedTo(member)}
                  className="justify-start"
                >
                  {assignedTo === member && <Check className="h-4 w-4 mr-2" />}
                  {member}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Library Prep By (Optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={libraryPrepBy === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLibraryPrepBy('')}
                className="justify-start"
              >
                {libraryPrepBy === '' && <Check className="h-4 w-4 mr-2" />}
                None
              </Button>
              {STAFF_MEMBERS.map((member) => (
                <Button
                  key={member}
                  variant={libraryPrepBy === member ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLibraryPrepBy(member)}
                  className="justify-start"
                >
                  {libraryPrepBy === member && <Check className="h-4 w-4 mr-2" />}
                  {member}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!assignedTo.trim()}>
            Assign Sample
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}