'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MindCard } from '@/components/mind-card'
import { RoundIndicator } from '@/components/round-indicator'
import { SynthesisCard } from '@/components/synthesis-card'
import { MINDS, type Response, type Round, type MindId } from '@/lib/minds'
import { Flame } from 'lucide-react'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function Crucible() {
  const [idea, setIdea] = useState('')
  const [isDebating, setIsDebating] = useState(false)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [responses, setResponses] = useState<Response[]>([])
  const [activeMinds, setActiveMinds] = useState<Set<MindId>>(new Set())
  const [synthesis, setSynthesis] = useState('')
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  const streamMindResponse = useCallback(async (
    mind: typeof MINDS[0],
    round: Round,
    ideaText: string,
    allResponses: Response[]
  ): Promise<Response> => {
    setActiveMinds(prev => new Set([...prev, mind.id]))

    const initialResponse: Response = {
      mindId: mind.id,
      round,
      content: '',
      isStreaming: true
    }

    setResponses(prev => [...prev, initialResponse])

    // Build previousResponses payload for the backend
    const previousResponses = allResponses.map(r => {
      const m = MINDS.find(mm => mm.id === r.mindId)
      return {
        mindName: m?.name ?? r.mindId,
        response: r.content
      }
    })

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: ideaText,
          mindId: mind.id,
          round,
          previousResponses,
          settings: { responseLength: 'long' }
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullContent += chunk

          setResponses(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(
              r => r.mindId === mind.id && r.round === round && r.isStreaming
            )
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], content: fullContent }
            }
            return updated
          })
        }
      }

      setResponses(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(
          r => r.mindId === mind.id && r.round === round && r.isStreaming
        )
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], isStreaming: false }
        }
        return updated
      })

      setActiveMinds(prev => {
        const next = new Set(prev)
        next.delete(mind.id)
        return next
      })

      return { mindId: mind.id, round, content: fullContent, isStreaming: false }
    } catch (error) {
      console.error(`Error for ${mind.name}:`, error)

      const errorMessage = `[Error: Could not get response]`

      setResponses(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(
          r => r.mindId === mind.id && r.round === round && r.isStreaming
        )
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], content: errorMessage, isStreaming: false }
        }
        return updated
      })

      setActiveMinds(prev => {
        const next = new Set(prev)
        next.delete(mind.id)
        return next
      })

      throw error
    }
  }, [])

  const runRound = useCallback(async (round: Round, ideaText: string, allResponses: Response[]) => {
    setCurrentRound(round)

    const roundResponses: Response[] = []

    for (let i = 0; i < MINDS.length; i++) {
      const mind = MINDS[i]

      // Small delay between minds to be gentle with rate limits
      if (i > 0 || round > 1) {
        await delay(1500)
      }

      try {
        const response = await streamMindResponse(mind, round, ideaText, allResponses)
        roundResponses.push(response)
      } catch (error) {
        console.error(`Mind ${mind.name} failed in round ${round}:`, error)
        roundResponses.push({
          mindId: mind.id,
          round,
          content: '[Error: Could not get response]',
          isStreaming: false
        })
      }
    }

    return [...allResponses, ...roundResponses]
  }, [streamMindResponse])

  const streamSynthesis = useCallback(async (ideaText: string, allResponses: Response[]) => {
    setCurrentRound('final')
    setIsSynthesizing(true)

    // Group responses by round for the synthesis endpoint
    const roundsMap = new Map<number, { mindName: string; response: string }[]>()
    for (const r of allResponses) {
      if (typeof r.round !== 'number') continue
      const m = MINDS.find(mm => mm.id === r.mindId)
      const arr = roundsMap.get(r.round) ?? []
      arr.push({ mindName: m?.name ?? r.mindId, response: r.content })
      roundsMap.set(r.round, arr)
    }

    const allResponsesPayload = Array.from(roundsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, responses]) => ({ round, responses }))

    try {
      const response = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: ideaText,
          allResponses: allResponsesPayload
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          setSynthesis(prev => prev + chunk)
        }
      }

      setIsSynthesizing(false)
    } catch (error) {
      console.error('Synthesis error:', error)
      setIsSynthesizing(false)
    }
  }, [])

  const startDebate = async () => {
    if (!idea.trim()) return

    setIsDebating(true)
    setHasStarted(true)
    setResponses([])
    setSynthesis('')
    setActiveMinds(new Set())

    try {
      let allResponses = await runRound(1, idea, [])
      allResponses = await runRound(2, idea, allResponses)
      allResponses = await runRound(3, idea, allResponses)
      await delay(1500)
      await streamSynthesis(idea, allResponses)
    } catch (error) {
      console.error('Debate error:', error)
    }

    setIsDebating(false)
  }

  const reset = () => {
    setIsDebating(false)
    setCurrentRound(null)
    setResponses([])
    setSynthesis('')
    setActiveMinds(new Set())
    setHasStarted(false)
    setIdea('')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Flame className="w-10 h-10 text-primary animate-pulse" style={{ filter: 'drop-shadow(0 0 10px var(--primary))' }} />
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              <span className="text-primary" style={{ textShadow: '0 0 30px var(--primary)' }}>CRUCIBLE</span>
            </h1>
            <Flame className="w-10 h-10 text-primary animate-pulse" style={{ filter: 'drop-shadow(0 0 10px var(--primary))' }} />
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Forge your ideas in the fire of debate. Four AI minds will challenge, defend, and transform your thinking across three rounds of intellectual battle.
          </p>
        </header>

        {/* Input Section */}
        {!hasStarted && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Enter an idea, decision, or question to forge..."
                className="flex-1 h-12 text-lg bg-input border-2 border-border focus:border-primary"
                onKeyDown={(e) => e.key === 'Enter' && startDebate()}
              />
              <Button
                onClick={startDebate}
                disabled={isDebating || !idea.trim()}
                className="h-12 px-8 text-lg font-semibold"
                style={{
                  boxShadow: '0 0 20px var(--primary)'
                }}
              >
                <Flame className="w-5 h-5 mr-2" />
                Enter the Crucible
              </Button>
            </div>
          </div>
        )}

        {/* Active Debate Section */}
        {hasStarted && (
          <>
            {/* Current Idea */}
            <div className="text-center mb-8">
              <div className="inline-block px-6 py-3 rounded-lg bg-card border-2 border-primary/50">
                <p className="text-lg font-medium text-balance">&ldquo;{idea}&rdquo;</p>
              </div>
              {!isDebating && synthesis && (
                <div className="mt-4">
                  <Button onClick={reset} variant="outline">
                    Forge a New Idea
                  </Button>
                </div>
              )}
            </div>

            {/* Round Progress */}
            <RoundIndicator
              currentRound={currentRound}
              isComplete={!isDebating && synthesis.length > 0}
            />

            {/* Mind Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {MINDS.map(mind => (
                <MindCard
                  key={mind.id}
                  mind={mind}
                  responses={responses}
                  currentRound={currentRound}
                  isActive={activeMinds.has(mind.id)}
                />
              ))}
            </div>

            {/* Synthesis */}
            <SynthesisCard content={synthesis} isStreaming={isSynthesizing} />
          </>
        )}
      </div>
    </div>
  )
}
