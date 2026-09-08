'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import OtpInput from '@m544/ui/auth/OtpInput'
import { useOtpVerification } from '@m544/ui/auth/useOtpVerification'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const { code, setCode, error, loading, resendLoading, resendMessage, handleVerify, handleResend } =
    useOtpVerification({ email, router })

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
            {/* 8-digit OTP input */}
            <OtpInput code={code} onChange={setCode} />

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
