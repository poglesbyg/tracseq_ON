import { motion } from 'framer-motion'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Copy,
  Star,
  AlertTriangle,
} from 'lucide-react'
import { useState, useMemo } from 'react'

import type { GuideRNA } from '../../lib/crispr/guide-design'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Progress } from '../ui/progress'

interface GuideResultsTableProps {
  guides: GuideRNA[]
  isLoading?: boolean
  onGuideSelect?: (guide: GuideRNA) => void
  onExportResults?: () => void
}

type SortField =
  | 'efficiencyScore'
  | 'specificityScore'
  | 'onTargetScore'
  | 'gcContent'
  | 'position'
type SortDirection = 'asc' | 'desc'

export function GuideResultsTable({
  guides,
  isLoading = false,
  onGuideSelect,
  onExportResults,
}: GuideResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('efficiencyScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedGuides = useMemo(() => {
    return [...guides].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [guides, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) {
      return 'text-green-400'
    }
    if (score >= 0.6) {
      return 'text-yellow-400'
    }
    return 'text-orange-400'
  }

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </th>
  )

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
            <span className="text-slate-400">Designing guide RNAs...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (guides.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Guide RNAs Found
          </h3>
          <p className="text-slate-400">
            No suitable guide RNAs were found for this sequence.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center space-x-2">
              <Star className="h-5 w-5" />
              <span>Guide RNA Results ({guides.length})</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportResults}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/20">
              <tr>
                <SortableHeader field="position">Position</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Guide Sequence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  PAM
                </th>
                <SortableHeader field="efficiencyScore">
                  Efficiency
                </SortableHeader>
                <SortableHeader field="specificityScore">
                  Specificity
                </SortableHeader>
                <SortableHeader field="gcContent">GC%</SortableHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sortedGuides.map((guide, index) => (
                <motion.tr
                  key={guide.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => onGuideSelect?.(guide)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-mono text-sm">
                        {guide.position}
                      </span>
                      <span className="text-slate-400 text-xs">
                        ({guide.strand})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <code className="text-white font-mono text-sm bg-black/20 px-2 py-1 rounded">
                        {guide.sequence}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(guide.sequence)
                        }}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <code className="text-slate-300 font-mono text-sm bg-black/20 px-2 py-1 rounded">
                      {guide.pamSequence}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Progress
                        value={guide.efficiencyScore * 100}
                        className="h-2 w-16 bg-black/20"
                      />
                      <span
                        className={`text-sm font-medium ${getScoreColor(guide.efficiencyScore)}`}
                      >
                        {(guide.efficiencyScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Progress
                        value={guide.specificityScore * 100}
                        className="h-2 w-16 bg-black/20"
                      />
                      <span
                        className={`text-sm font-medium ${getScoreColor(guide.specificityScore)}`}
                      >
                        {(guide.specificityScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">
                      {guide.gcContent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(`${guide.sequence}${guide.pamSequence}`)
                      }}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                      title="Copy Full Sequence"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  )
}
