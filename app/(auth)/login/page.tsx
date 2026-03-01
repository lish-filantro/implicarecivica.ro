'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom') || '/chat'
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(callbackError === 'auth_callback_failed' ? 'Autentificarea a eșuat. Încearcă din nou.' : '')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email sau parolă incorectă.'
          : error.message === 'Email not confirmed'
            ? 'Emailul nu a fost confirmat. Verifică-ți inbox-ul.'
            : error.message
      )
      setLoading(false)
      return
    }

    router.push(redirectedFrom)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Autentificare</CardTitle>
          <CardDescription>
            Intră în contul tău pentru a accesa platforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="adresa@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parolă</Label>
              <Input
                id="password"
                type="password"
                placeholder="Parola ta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Se conectează...' : 'Intră în cont'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/reset-password" className="text-sm text-muted-foreground hover:text-primary hover:underline">
              Ai uitat parola?
            </Link>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Nu ai cont?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Înregistrează-te
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
