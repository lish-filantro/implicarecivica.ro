'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [code, setCode] = useState(['', '', '', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-advance to next input
    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Go back on backspace if current input is empty
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (pasted.length === 0) return

    const newCode = [...code]
    for (let i = 0; i < 8; i++) {
      newCode[i] = pasted[i] || ''
    }
    setCode(newCode)

    // Focus last filled input or submit if all filled
    const lastIndex = Math.min(pasted.length, 8) - 1
    inputRefs.current[lastIndex]?.focus()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.join('')

    if (token.length !== 8) {
      setError('Introdu toate cele 8 cifre.')
      return
    }

    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) {
      setError(
        error.message === 'Token has expired or is invalid'
          ? 'Codul a expirat sau este invalid. Solicită unul nou.'
          : error.message
      )
      setLoading(false)
      return
    }

    // Success — user is now authenticated, redirect to pending approval
    // (middleware will redirect to dashboard if already approved)
    router.push('/pending-approval')
    router.refresh()
  }

  const handleResend = async () => {
    if (!email) return
    setResendLoading(true)
    setResendMessage('')
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      setError(error.message)
    } else {
      setResendMessage('Un cod nou a fost trimis pe email.')
    }
    setResendLoading(false)
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Nu s-a specificat un email pentru verificare.</p>
            <Link href="/register">
              <Button>Înregistrează-te</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verifică emailul</CardTitle>
          <CardDescription>
            Am trimis un cod de 8 cifre la<br />
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            {/* 6-digit OTP input */}
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-10 h-12 text-center text-lg font-bold p-0"
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            {resendMessage && (
              <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
                {resendMessage}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Se verifică...' : 'Verifică codul'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {resendLoading ? 'Se trimite...' : 'Nu ai primit codul? Trimite din nou'}
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/register" className="text-primary hover:underline">
              Folosește alt email
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
