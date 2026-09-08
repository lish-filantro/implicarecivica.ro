'use client'

import { useState } from 'react'
import { createBrowserClient } from '@m544/shared/db/browser-client'
import { emptyOtpCode, OTP_LENGTH } from './OtpInput'

interface AuthError {
  message: string
}

/** The two Supabase auth calls the verify page needs (injectable for tests). */
export interface OtpAuthClient {
  verifyOtp(params: { email: string; token: string; type: 'signup' }): Promise<{ error: AuthError | null }>
  resend(params: { type: 'signup'; email: string }): Promise<{ error: AuthError | null }>
}

export interface OtpRouter {
  push: (href: string) => void
  refresh: () => void
}

export interface UseOtpVerificationOptions {
  email: string
  router: OtpRouter
  /** Defaults to a fresh browser Supabase client per call (as the page did). */
  createAuthClient?: () => OtpAuthClient
}

export const OTP_INCOMPLETE_ERROR = 'Introdu toate cele 8 cifre.'
export const OTP_INVALID_ERROR = 'Codul a expirat sau este invalid. Solicită unul nou.'
export const OTP_RESENT_MESSAGE = 'Un cod nou a fost trimis pe email.'

const defaultAuthClient = (): OtpAuthClient => createBrowserClient().auth

/** Maps Supabase's OTP error to the Romanian message shown to the user. */
export function mapOtpError(message: string): string {
  return message === 'Token has expired or is invalid' ? OTP_INVALID_ERROR : message
}

/**
 * State + actions of the signup OTP page: 8-digit code, verify (→ /pending-approval
 * on success, middleware redirects approved users), resend with feedback.
 */
export function useOtpVerification({
  email,
  router,
  createAuthClient = defaultAuthClient,
}: UseOtpVerificationOptions) {
  const [code, setCode] = useState<string[]>(emptyOtpCode)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.join('')

    if (token.length !== OTP_LENGTH) {
      setError(OTP_INCOMPLETE_ERROR)
      return
    }

    setError('')
    setLoading(true)

    const { error } = await createAuthClient().verifyOtp({ email, token, type: 'signup' })

    if (error) {
      setError(mapOtpError(error.message))
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

    const { error } = await createAuthClient().resend({ type: 'signup', email })

    if (error) {
      setError(error.message)
    } else {
      setResendMessage(OTP_RESENT_MESSAGE)
    }
    setResendLoading(false)
  }

  return { code, setCode, error, loading, resendLoading, resendMessage, handleVerify, handleResend }
}
