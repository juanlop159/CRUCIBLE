export type MindId = 'visionary' | 'destroyer' | 'pragmatist' | 'synthesizer'

export interface Mind {
  id: MindId
  name: string
  tagline: string
  color: string
  colorClass: string
  borderClass: string
  bgClass: string
  systemPrompt: string
}

export const MINDS: Mind[] = [
  {
    id: 'visionary',
    name: 'The Visionary',
    tagline: 'Sees infinite possibility',
    color: 'var(--mind-visionary)',
    colorClass: 'text-mind-visionary',
    borderClass: 'border-mind-visionary',
    bgClass: 'bg-mind-visionary/10',
    systemPrompt: `You are The Visionary. You see infinite possibility in every idea. You dream big, imagine the best-case scenarios, and paint compelling pictures of what could be. You're optimistic to a fault, always finding the potential and opportunity others miss. You speak with enthusiasm and paint vivid futures. Keep responses concise but inspiring - 2-3 paragraphs max.`
  },
  {
    id: 'destroyer',
    name: 'The Destroyer',
    tagline: 'Finds every flaw brutally',
    color: 'var(--mind-destroyer)',
    colorClass: 'text-mind-destroyer',
    borderClass: 'border-mind-destroyer',
    bgClass: 'bg-mind-destroyer/10',
    systemPrompt: `You are The Destroyer. You ruthlessly identify flaws, weaknesses, and failure modes. No idea survives your scrutiny unscathed. You're not cruel - you're honest about risks others refuse to see. You speak directly and without mercy, but your goal is to strengthen ideas by exposing their weaknesses. Keep responses concise but devastating - 2-3 paragraphs max.`
  },
  {
    id: 'pragmatist',
    name: 'The Pragmatist',
    tagline: 'Only cares about what works',
    color: 'var(--mind-pragmatist)',
    colorClass: 'text-mind-pragmatist',
    borderClass: 'border-mind-pragmatist',
    bgClass: 'bg-mind-pragmatist/10',
    systemPrompt: `You are The Pragmatist. You only care about what actually works in practice. Theory and idealism bore you. You ask: What's the first step? What resources do we need? What's been tried before? You ground every discussion in reality and executable actions. Keep responses concise and practical - 2-3 paragraphs max.`
  },

  {
    id: 'synthesizer',
    name: 'The Synthesizer',
    tagline: 'Finds hidden connections',
    color: 'var(--mind-synthesizer)',
    colorClass: 'text-mind-synthesizer',
    borderClass: 'border-mind-synthesizer',
    bgClass: 'bg-mind-synthesizer/10',
    systemPrompt: `You are The Synthesizer. You find unexpected connections between seemingly unrelated ideas. You see patterns others miss, integrate opposing viewpoints, and build bridges between perspectives. You're the one who says "what if we combined..." You speak thoughtfully, weaving ideas together. Keep responses concise but connective - 2-3 paragraphs max.`
  }
]

export type Round = 1 | 2 | 3 | 'final'

export interface Response {
  mindId: MindId
  round: Round
  content: string
  isStreaming: boolean
}

export function getRoundPrompt(
  round: Round,
  idea: string,
  previousResponses: Response[]
): string {
  const roundOneResponses = previousResponses.filter(r => r.round === 1)
  const roundTwoResponses = previousResponses.filter(r => r.round === 2)

  if (round === 1) {
    return `The idea being debated is: "${idea}"

Give your initial take on this idea. Be true to your perspective.`
  }

  if (round === 2) {
    const context = roundOneResponses
      .map(r => {
        const mind = MINDS.find(m => m.id === r.mindId)
        return `${mind?.name}: ${r.content}`
      })
      .join('\n\n')

    return `The idea being debated is: "${idea}"

Here's what each mind said in Round 1:

${context}

Now respond to the other minds' perspectives. Agree, attack, build on their ideas. Engage directly with what they said.`
  }

  if (round === 3) {
    const round1Context = roundOneResponses
      .map(r => {
        const mind = MINDS.find(m => m.id === r.mindId)
        return `${mind?.name}: ${r.content}`
      })
      .join('\n\n')

    const round2Context = roundTwoResponses
      .map(r => {
        const mind = MINDS.find(m => m.id === r.mindId)
        return `${mind?.name}: ${r.content}`
      })
      .join('\n\n')

    return `The idea being debated is: "${idea}"

Round 1 responses:
${round1Context}

Round 2 responses:
${round2Context}

This is the final round. Having heard all perspectives across two rounds of debate, forge your final position. What do you now believe about this idea? What has changed or solidified in your thinking?`
  }

  return ''
}

export function getSynthesisPrompt(idea: string, responses: Response[]): string {
  const allResponses = responses
    .sort((a, b) => {
      const roundOrder = { 1: 1, 2: 2, 3: 3, final: 4 }
      return roundOrder[a.round] - roundOrder[b.round]
    })
    .map(r => {
      const mind = MINDS.find(m => m.id === r.mindId)
      return `[Round ${r.round}] ${mind?.name}: ${r.content}`
    })
    .join('\n\n')

  return `You are an impartial observer who has witnessed a fierce intellectual debate about the following idea: "${idea}"

Here is the complete debate across all rounds:

${allResponses}

Write a synthesis of this debate. What key insights emerged? Where did the minds agree or fundamentally disagree? What survived the crucible of debate? What changed? What's the strongest case for and against this idea?

Write 3-4 paragraphs that capture the essence of what was forged in this debate.`
}
