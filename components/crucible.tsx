'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MindCard } from '@/components/mind-card'
import { RoundIndicator } from '@/components/round-indicator'
import { SynthesisCard } from '@/components/synthesis-card'
import { SettingsPanel } from '@/components/settings-panel'
import { MINDS, type Response, type Round, type MindId, getRoundPrompt, getSynthesisPrompt } from '@/lib/minds'
import { Flame } from 'lucide-react'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function Crucible() {
  const [apiKey, setApiKey] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
    const prompt = getRoundPrompt(round, ideaText, allResponses)
    
    setActiveMinds(prev => new Set([...prev, mind.id]))
    
    // Add initial streaming response
    const initialResponse: Response = {
      mindId: mind.id,
      round,
      content: '',
      isStreaming: true
    }
    
    setResponses(prev => [...prev, initialResponse])
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: mind.systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 250,
          stream: true
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

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                fullContent += content

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
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Mark as complete
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
      
      // Update the streaming response to show error state
      const errorMessage = error instanceof Error && error.message.includes('429')
        ? '[Rate limited - please wait and try again]'
        : `[Error: Could not get response]`
      
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
  }, [apiKey])

  const runRound = useCallback(async (round: Round, ideaText: string, allResponses: Response[]) => {
    setCurrentRound(round)

    // Run minds sequentially to avoid rate limits
    // Each mind gets all previous responses as context
    const roundResponses: Response[] = []
    
    for (let i = 0; i < MINDS.length; i++) {
      const mind = MINDS[i]
      
      // Determine delay: 10 seconds for Synthesizer in Round 3, 5 seconds for all others
      const isSynthesizerRound3 = mind.id === 'synthesizer' && round === 3
      const delayMs = isSynthesizerRound3 ? 10000 : 5000
      
      // Add delay between ALL minds (except for very first call of round 1)
      if (i > 0 || round > 1) {
        await delay(delayMs)
      }
      
      // Synthesizer gets automatic retry logic (up to 3 retries with 15 second waits)
      const maxRetries = mind.id === 'synthesizer' ? 3 : 1
      let lastError: Error | null = null
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Clear the previous error response before retry
            setResponses(prev => prev.filter(
              r => !(r.mindId === mind.id && r.round === round)
            ))
            await delay(15000) // Wait 15 seconds before retry
          }
          
          const response = await streamMindResponse(mind, round, ideaText, allResponses)
          roundResponses.push(response)
          lastError = null
          break // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          console.error(`Mind ${mind.name} failed in round ${round} (attempt ${attempt + 1}/${maxRetries}):`, error)
          
          // Only retry for rate limits on Synthesizer
          const isRateLimit = lastError.message.includes('429')
          if (mind.id !== 'synthesizer' || !isRateLimit || attempt === maxRetries - 1) {
            break
          }
        }
      }
      
      // If all retries failed, add fallback response
      if (lastError) {
        const errorMessage = lastError.message.includes('429')
          ? '[Rate limited - please wait and try again]'
          : '[Error: Could not get response]'
        roundResponses.push({
          mindId: mind.id,
          round,
          content: errorMessage,
          isStreaming: false
        })
      }
    }
    
    return [...allResponses, ...roundResponses]
  }, [streamMindResponse])

  const streamSynthesis = useCallback(async (ideaText: string, allResponses: Response[]) => {
    setCurrentRound('final')
    setIsSynthesizing(true)

    const prompt = getSynthesisPrompt(ideaText, allResponses)

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an impartial observer synthesizing a debate. Write clearly and insightfully.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600,
          stream: true
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

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                setSynthesis(prev => prev + content)
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      setIsSynthesizing(false)
    } catch (error) {
      console.error('Synthesis error:', error)
      setIsSynthesizing(false)
    }
  }, [apiKey])

  const startDebate = async () => {
    if (!apiKey) {
      setSettingsOpen(true)
      return
    }

    if (!idea.trim()) return

    setIsDebating(true)
    setHasStarted(true)
    setResponses([])
    setSynthesis('')
    setActiveMinds(new Set())

    try {
      // All 12 mind calls + 1 synthesis call are strictly sequential
      // 5 second delay is applied before each call (except the very first)
      
      // Round 1 (4 minds)
      let allResponses = await runRound(1, idea, [])
      
      // Round 2 (4 minds) - delay handled inside runRound
      allResponses = await runRound(2, idea, allResponses)
      
      // Round 3 (4 minds) - delay handled inside runRound
      allResponses = await runRound(3, idea, allResponses)
      
      // Delay before synthesis
      await delay(5000)
      
      // Final synthesis
      await streamSynthesis(idea, allResponses)
      
    } catch (error) {
      console.error('Debate error:', error)
    }
    
    // Mark debate as complete but keep all state visible
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
      <SettingsPanel
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

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
            {!apiKey && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Click the settings icon (⚙️) to add your Groq API key
              </p>
            )}
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
