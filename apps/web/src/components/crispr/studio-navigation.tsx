import { motion } from 'framer-motion'
import {
  BarChart3,
  Target,
  Layers,
  Microscope,
  Zap,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type StudioTab =
  | 'dashboard'
  | 'design'
  | 'batch'
  | 'analysis'
  | 'ai'
  | 'results'

interface TabConfig {
  id: StudioTab
  label: string
  icon: LucideIcon
}

interface StudioNavigationProps {
  activeTab: StudioTab
  onTabChange: (tab: StudioTab) => void
}

const tabConfigs: TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'design', label: 'Guide Design', icon: Target },
  { id: 'batch', label: 'Batch Processing', icon: Layers },
  { id: 'analysis', label: 'Analysis', icon: Microscope },
  { id: 'ai', label: 'AI Tools', icon: Zap },
  { id: 'results', label: 'Results', icon: Settings },
]

export function StudioNavigation({
  activeTab,
  onTabChange,
}: StudioNavigationProps) {
  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="border-b border-border bg-muted"
    >
      <div className="container mx-auto px-6">
        <div className="flex space-x-1">
          {tabConfigs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground border-b-2 border-primary shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}
