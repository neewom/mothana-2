import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StatusNoticeTone = 'neutral' | 'warning' | 'success' | 'danger' | 'success-emphasis' | 'danger-emphasis'

const TONE_CLASSES: Record<StatusNoticeTone, string> = {
  neutral: 'border-paper-border bg-white text-ink-muted',
  warning: 'border-warning-border bg-warning-tint text-warning',
  success: 'border-success/60 bg-success/[0.12] text-success',
  danger: 'border-stamp/45 bg-stamp/[0.08] text-stamp',
  'success-emphasis': 'border-2 border-success bg-success/[0.14] text-success',
  'danger-emphasis': 'border-2 border-stamp bg-stamp/[0.10] text-stamp',
}

interface StatusNoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: StatusNoticeTone
  heading?: ReactNode
}

export function StatusNotice({
  tone = 'neutral',
  heading,
  children,
  className,
  role = 'status',
  ...props
}: StatusNoticeProps) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-sm border px-4 py-3 font-registre text-sm leading-5',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {heading && <p className="text-base font-semibold leading-6">{heading}</p>}
      {children && <div className={cn(heading && 'mt-1')}>{children}</div>}
    </div>
  )
}
