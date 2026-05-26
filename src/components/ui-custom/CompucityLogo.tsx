'use client'

import Image from 'next/image'

interface CompucityLogoProps {
  variant?: 'full' | 'icon' | 'horizontal'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  whiteText?: boolean
}

const sizeMap = {
  sm: { icon: 30, text: 'text-base', tagline: 'text-[7px]' },
  md: { icon: 36, text: 'text-lg', tagline: 'text-[8px]' },
  lg: { icon: 42, text: 'text-xl', tagline: 'text-[9px]' },
  xl: { icon: 48, text: 'text-2xl', tagline: 'text-[10px]' },
}

export default function CompucityLogo({
  variant = 'full',
  size = 'md',
  className = '',
  whiteText = false
}: CompucityLogoProps) {
  const s = sizeMap[size]

  const greenColor = '#3A8B68'
  const textColor = whiteText ? '#FFFFFF' : '#1a1a1a'
  const greenText = greenColor
  const taglineColor = whiteText ? 'rgba(255,255,255,0.6)' : '#6b7280'

  const IconImg = () => (
    <Image
      src="/images/logo-compucity-icon.png"
      alt="Compucity"
      width={191}
      height={180}
      className="shrink-0"
      style={{ width: s.icon, height: 'auto' }}
      priority
    />
  )

  if (variant === 'icon') {
    return <span className={`inline-flex ${className}`}><IconImg /></span>
  }

  if (variant === 'horizontal') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <IconImg />
        <span className={`font-extrabold tracking-tight leading-none ${s.text}`} style={{ color: textColor }}>
          COMPU<span style={{ color: greenText }}>CITY</span>
        </span>
      </span>
    )
  }

  // Full variant: icon + text + tagline
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <IconImg />
      <span className="flex flex-col">
        <span className={`font-extrabold tracking-tight leading-none ${s.text}`} style={{ color: textColor }}>
          COMPU<span style={{ color: greenText }}>CITY</span>
        </span>
        <span className={`font-semibold tracking-[0.15em] mt-0.5 ${s.tagline}`} style={{ color: taglineColor }}>
          TU MUNDO DIGITAL
        </span>
      </span>
    </span>
  )
}
