import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

export async function POST(req: Request) {
  const { topic, allResponses } = await req.json()

  const roundsText = allResponses.map((round: { round: number; responses: { mindName: string; response: string }[] }) => {
    return `Round ${round.round}:\n${round.responses.map((r: { mindName: string; response: string }) =>
      `${r.mindName}: ${r.response}`
    ).join('\n\n')}`
  }).join('\n\n---\n\n')

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `You are a neutral synthesizer analyzing a multi-perspective debate. Your role is to:
1. Identify the key insights and strongest arguments from all perspectives
2. Note areas of agreement and fundamental disagreements
3. Highlight any surprising or counterintuitive points raised
4. Provide a balanced executive summary of the debate

Be concise, insightful, and fair to all perspectives.`,
    messages: [
      {
        role: 'user',
        content: `Topic: "${topic}"

Full debate transcript:

${roundsText}

Please provide a synthesis of this debate, highlighting key insights and the strongest arguments from each perspective.`
      }
    ],
    maxOutputTokens: 1200,
  })

  return result.toTextStreamResponse()
}
