'use client'

import type { ReactNode } from 'react'
import { BorderBeam } from 'border-beam'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'

export default function FocusBeam({ children, active = false }: { children: ReactNode; active?: boolean }) {
  const motionAllowed = useMotionAllowed()
  return (
    <BorderBeam className="focus-beam" size="md" colorVariant="ocean" strength={0.45}
      duration={7} theme="dark" active={active && motionAllowed} borderRadius={24}>
      {children}
    </BorderBeam>
  )
}
