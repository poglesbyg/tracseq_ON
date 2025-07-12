import { motion } from 'framer-motion'
import { Dna, Settings } from 'lucide-react'

import { Button } from '../ui/button'

interface StudioHeaderProps {
  onSettingsClick?: () => void
}

export function StudioHeader({ onSettingsClick }: StudioHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border bg-white shadow-sm"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary rounded-lg">
              <Dna className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                CRISPR Design Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-Powered Gene Editing Platform
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="transition-all duration-200"
              onClick={onSettingsClick}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  )
} 