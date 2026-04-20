'use client'

import { cn } from '@/lib/utils'
import { type Round } from '@/lib/minds'

interface RoundIndicatorProps {
  currentRound: Round | null
  isComplete: boolean
}

const rounds: { id: Round; label: string }[] = [
  { id: 1, label: 'Round 1' },
  { id: 2, label: 'Round 2' },
  { id: 3, label: 'Round 3' },
  { id: 'final', label: 'Synthesis' }
]

export function RoundIndicator({ currentRound, isComplete }: RoundIndicatorProps) {
  const getRoundStatus = (roundId: Round) => {
    if (isComplete) return 'complete'
    if (currentRound === null) return 'pending'
    
    const roundOrder = { 1: 1, 2: 2, 3: 3, final: 4 }
    const currentOrder = roundOrder[currentRound]
    const thisOrder = roundOrder[roundId]
    
    if (thisOrder < currentOrder) return 'complete'
    if (thisOrder === currentOrder) return 'active'
    return 'pending'
  }

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {rounds.map((round, idx) => {
        const status = getRoundStatus(round.id)
        
        return (
          <div key={round.id} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 border-2',
                  status === 'complete' && 'bg-primary text-primary-foreground border-primary',
                  status === 'active' && 'bg-primary/20 text-primary border-primary animate-pulse shadow-lg shadow-primary/30',
                  status === 'pending' && 'bg-muted text-muted-foreground border-muted'
                )}
                style={{
                  ...(status === 'active' && {
                    boxShadow: '0 0 30px var(--primary)'
                  })
                }}
              >
                {round.id === 'final' ? '★' : round.id}
              </div>
              <span
                className={cn(
                  'text-xs font-medium transition-colors',
                  status === 'complete' && 'text-primary',
                  status === 'active' && 'text-primary',
                  status === 'pending' && 'text-muted-foreground'
                )}
              >
                {round.label}
              </span>
            </div>
            
            {idx < rounds.length - 1 && (
              <div
                className={cn(
                  'w-16 h-0.5 mx-3 mb-6 transition-all duration-500',
                  getRoundStatus(rounds[idx + 1].id) !== 'pending'
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
