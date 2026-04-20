'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type Mind, type Response, type Round } from '@/lib/minds'
import { cn } from '@/lib/utils'

interface MindCardProps {
  mind: Mind
  responses: Response[]
  currentRound: Round | null
  isActive: boolean
}

export function MindCard({ mind, responses, currentRound, isActive }: MindCardProps) {
  const mindResponses = responses.filter(r => r.mindId === mind.id)
  const currentResponse = mindResponses.find(r => r.round === currentRound && r.isStreaming)

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-500 border-2',
        mind.borderClass,
        mind.bgClass,
        isActive && 'ring-2 ring-offset-2 ring-offset-background',
        isActive && `ring-[${mind.color}]`
      )}
      style={{
        borderColor: mind.color,
        backgroundColor: `color-mix(in oklch, ${mind.color} 8%, var(--card))`,
        ...(isActive && { boxShadow: `0 0 30px color-mix(in oklch, ${mind.color} 30%, transparent)` })
      }}
    >
      {/* Glow effect when active */}
      {isActive && (
        <div
          className="absolute inset-0 opacity-20 animate-pulse"
          style={{
            background: `radial-gradient(ellipse at center, ${mind.color}, transparent 70%)`
          }}
        />
      )}

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: mind.color, boxShadow: `0 0 10px ${mind.color}` }}
          />
          <div>
            <CardTitle className="text-lg" style={{ color: mind.color }}>
              {mind.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{mind.tagline}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4 max-h-[400px] overflow-y-auto">
        {mindResponses.length === 0 && !isActive && (
          <p className="text-muted-foreground text-sm italic">Awaiting the crucible...</p>
        )}

        {mindResponses.length === 0 && isActive && (
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: mind.color }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: mind.color, animationDelay: '0.1s' }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: mind.color, animationDelay: '0.2s' }}
            />
          </div>
        )}

        {mindResponses.map((response, idx) => (
          <div key={`${response.mindId}-${response.round}-${idx}`} className="space-y-1">
            <div
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: mind.color }}
            >
              Round {response.round}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {response.content}
              {response.isStreaming && (
                <span
                  className="inline-block w-2 h-4 ml-1 animate-pulse"
                  style={{ backgroundColor: mind.color }}
                />
              )}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
