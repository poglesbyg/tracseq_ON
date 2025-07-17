import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current device is mobile
 * @param breakpoint - The breakpoint to consider as mobile (default: 768px)
 * @returns boolean indicating if the device is mobile
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // Check on mount
    checkIsMobile()

    // Add event listener
    window.addEventListener('resize', checkIsMobile)

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [breakpoint])

  return isMobile
} 