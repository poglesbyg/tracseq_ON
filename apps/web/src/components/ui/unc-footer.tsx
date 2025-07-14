import { ExternalLink } from 'lucide-react'

export function UNCFooter() {
  const currentYear = new Date().getFullYear()

  const footerLinks = [
    {
      title: 'University Resources',
      links: [
        {
          label: 'UNC-Chapel Hill',
          href: 'https://www.unc.edu/',
          external: true,
        },
        { label: 'Events', href: 'https://events.unc.edu/', external: true },
        {
          label: 'Libraries',
          href: 'https://library.unc.edu/',
          external: true,
        },
        { label: 'Maps', href: 'https://maps.unc.edu/', external: true },
        {
          label: 'Departments',
          href: 'https://www.unc.edu/departments/',
          external: true,
        },
      ],
    },
    {
      title: 'TracSeq ON',
      links: [
        { label: 'CRISPR Studio', href: '/crispr', external: false },
        { label: 'Nanopore Tracking', href: '/nanopore', external: false },
        { label: 'About', href: '/about', external: false },
        { label: 'Contact', href: '/contact', external: false },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Documentation', href: '/help', external: false },
        { label: 'System Status', href: '/status', external: false },
        { label: 'Report Issue', href: '/support', external: false },
      ],
    },
  ]

  const legalLinks = [
    {
      label: 'Accessibility',
      href: 'https://accessibility.unc.edu/report-a-barrier/',
      external: true,
    },
    {
      label: 'Privacy Policy',
      href: 'https://www.unc.edu/privacy-policy/',
      external: true,
    },
    {
      label: 'Terms of Use',
      href: 'https://www.unc.edu/terms-of-use/',
      external: true,
    },
    { label: 'Title IX', href: 'https://titleix.unc.edu/', external: true },
  ]

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* University Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              {/* UNC Old Well Icon */}
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <div className="w-5 h-5 bg-primary-foreground rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
              <div className="text-sm font-medium text-secondary-foreground">UNC-Chapel Hill</div>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              TracSeq ON - AI-Driven Laboratory Management Platform
            </div>
            <div className="text-xs text-muted-foreground">
              <div>The University of North Carolina at Chapel Hill</div>
              <div>Chapel Hill, NC 27599</div>
              <div className="mt-2">University Operator: (919) 962-2211</div>
            </div>
          </div>

          {/* Footer Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-secondary-foreground mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-sm text-muted-foreground hover:text-secondary-foreground transition-colors duration-200 flex items-center space-x-1"
                    >
                      <span>{link.label}</span>
                      {link.external && <ExternalLink className="h-3 w-3" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-muted-foreground mb-4 md:mb-0">
              © {currentYear} The University of North Carolina at Chapel Hill
            </div>
            <nav className="flex flex-wrap gap-4">
              {legalLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="text-sm text-muted-foreground hover:text-secondary-foreground transition-colors duration-200 flex items-center space-x-1"
                >
                  <span>{link.label}</span>
                  {link.external && <ExternalLink className="h-3 w-3" />}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
