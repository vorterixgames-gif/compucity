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
  xl: { icon: 64 },
}

export default function CompucityLogo({
  size = 'md',
  className = '',
  whiteText = false,
}: CompucityLogoProps) {
  const s = sizeMap[size]

  return (
    <span className={`inline-flex ${whiteText ? 'bg-white/95 rounded-lg px-2.5 py-1.5' : ''} ${className}`}>
      <Image
        src="/images/logo-compucity-icon.png"
        alt="Compucity"
        width={720}
        height={286}
        className="shrink-0"
        style={{
          height: s.icon,
          width: 'auto',
        }}
        priority
      />
    </span>
  )
}
