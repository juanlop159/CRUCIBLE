'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Settings, X } from 'lucide-react'

interface SettingsPanelProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
  isOpen: boolean
  onToggle: () => void
}

export function SettingsPanel({ apiKey, onApiKeyChange, isOpen, onToggle }: SettingsPanelProps) {
  const [showKey, setShowKey] = useState(false)
  const [localKey, setLocalKey] = useState(apiKey)

  const handleSave = () => {
    onApiKeyChange(localKey)
    onToggle()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed top-4 right-4 z-50"
      >
        <Settings className="w-5 h-5" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md border-2 border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Settings</CardTitle>
              <Button variant="ghost" size="icon" onClick={onToggle}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Groq API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={localKey}
                      onChange={(e) => setLocalKey(e.target.value)}
                      placeholder="gsk_..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.groq.com
                  </a>
                </p>
              </div>
              <Button onClick={handleSave} className="w-full">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
