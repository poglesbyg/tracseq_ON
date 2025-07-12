import { motion } from 'framer-motion'

import { Card, CardContent } from '../ui/card'

export function ResultsView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-foreground">Results & Export</h2>
      <Card className="bg-card border-border">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-muted-foreground text-lg mb-2">
              Results Display Coming Soon
            </p>
            <p className="text-muted-foreground text-sm">
              This section will contain comprehensive result analysis and export
              options
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
