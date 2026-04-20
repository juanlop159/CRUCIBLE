'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SynthesisCardProps {
  content: string
  isStreaming: boolean
}

export function SynthesisCard({ content, isStreaming }: SynthesisCardProps) {
  if (!content && !isStreaming) return null

  return (
    <Card className="border-2 border-primary bg-primary/5 relative overflow-hidden">
      {/* Dramatic glow effect */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: 'radial-gradient(ellipse at center, var(--primary), transparent 70%)'
        }}
      />

      <CardHeader className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-primary animate-pulse" style={{ boxShadow: '0 0 20px var(--primary)' }} />
          <CardTitle className="text-2xl text-primary">What Emerged from the Crucible</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {!content && isStreaming && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        )}
        
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-lg">
          {content}
          {isStreaming && content && (
            <span className="inline-block w-2 h-5 ml-1 bg-primary animate-pulse" />
          )}
        </p>
      </CardContent>
    </Card>
  )
}
