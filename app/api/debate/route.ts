import { streamText } from 'ai'
import { MINDS, type Mind } from '@/lib/minds'

export async function POST(req: Request) {
  const { topic, mindId, round, previousResponses, settings } = await req.json()
  
  const mind = MINDS.find((m: Mind) => m.id === mindId)
  if (!mind) {
    return new Response('Mind not found', { status: 404 })
  }

  // Build context from previous responses
  let context = ''
  if (previousResponses && previousResponses.length > 0) {
    context = '\n\nPrevious perspectives from other minds:\n' + 
      previousResponses.map((r: { mindName: string; response: string }) => 
        `${r.mindName}: ${r.response}`
      ).join('\n\n')
  }

  const roundInstructions = {
    1: 'This is Round 1: Initial Positions. Present your initial perspective on this topic clearly and concisely.',
    2: 'This is Round 2: Challenge & Defend. You\'ve seen other perspectives. Challenge weak arguments and defend your position where appropriate. Be specific about which points you agree or disagree with.',
    3: 'This is Round 3: Synthesis. Identify the strongest insights from the debate. Acknowledge valid opposing points. Offer your refined, nuanced final position.',
  }

  const systemPrompt = `You are ${mind.name}, ${mind.description}

Your personality and approach:
${mind.personality}

${roundInstructions[round as keyof typeof roundInstructions]}

Guidelines:
- Keep your response focused and substantive (${settings?.responseLength === 'short' ? '2-3 sentences' : settings?.responseLength === 'long' ? '4-6 sentences' : '3-4 sentences'})
- Stay true to your persona's perspective
- Be intellectually honest - acknowledge good points from others
- Avoid repetition of points already made
- Be direct and impactful`

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Topic for debate: "${topic}"${context}

Now provide your ${round === 1 ? 'initial position' : round === 2 ? 'challenge and defense' : 'final synthesis'}.`
      }
    ],
    maxOutputTokens: settings?.responseLength === 'short' ? 150 : settings?.responseLength === 'long' ? 400 : 250,
  })

  return result.toTextStreamResponse()
}
