import { UNCFooter } from '../ui/unc-footer'
import { UNCHeader } from '../ui/unc-header'
import { UtilityBar } from '../ui/utility-bar'

interface UNCLayoutProps {
  children: React.ReactNode
  showUtilityBar?: boolean
  showHeader?: boolean
  showFooter?: boolean
}

export function UNCLayout({
  children,
  showUtilityBar = true,
  showHeader = true,
  showFooter = true,
}: UNCLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {showUtilityBar && <UtilityBar />}
      {showHeader && <UNCHeader />}
      <main className="flex-1">{children}</main>
      {showFooter && <UNCFooter />}
    </div>
  )
}
