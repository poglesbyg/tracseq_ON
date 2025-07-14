import { ExternalLink } from 'lucide-react'

export function UtilityBar() {
  const utilityLinks = [
    {
      label: 'Accessibility',
      href: 'https://accessibility.unc.edu/report-a-barrier/',
      external: true,
    },
    { label: 'Events', href: 'https://events.unc.edu/', external: true },
    { label: 'Libraries', href: 'https://library.unc.edu/', external: true },
    { label: 'Maps', href: 'https://maps.unc.edu/', external: true },
    {
      label: 'Departments',
      href: 'https://www.unc.edu/departments/',
      external: true,
    },
    {
      label: 'ConnectCarolina',
      href: 'https://connectcarolina.unc.edu/',
      external: true,
    },
  ]

  return (
    <div className="bg-secondary text-secondary-foreground text-sm py-2 px-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          The University of North Carolina at Chapel Hill
        </div>
        <nav className="flex space-x-4">
          {utilityLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="text-secondary-foreground hover:text-primary transition-colors duration-200 flex items-center space-x-1"
            >
              <span>{link.label}</span>
              {link.external && <ExternalLink className="h-3 w-3" />}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
