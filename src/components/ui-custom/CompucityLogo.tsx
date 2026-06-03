'use client'

import Image from 'next/image'

interface CompucityLogoProps {
  variant?: 'full' | 'icon' | 'horizontal'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  whiteText?: boolean
}

const sizeMap = {
  sm: { icon: 30 },
  md: { icon: 36 },
  lg: { icon: 42 },
  xl: { icon: 56 },
}

export default function CompucityLogo({
  size = 'md',
  className = '',
}: CompucityLogoProps) {
  const s = sizeMap[size]

  return (
    <span className={`inline-flex ${className}`}>
      <Image
        src="/images/logo-compucity-icon.png"
        alt="Compucity"
        width={720}
        height={286}
        className="shrink-0"
        style={{ height: s.icon, width: 'auto' }}
        priority
      />
    </span>
  )
}
