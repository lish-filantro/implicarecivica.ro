'use client'

import { useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

export const OTP_LENGTH = 8

/** Empty code: one slot per digit. */
export function emptyOtpCode(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => '')
}

interface OtpInputProps {
  code: string[]
  onChange: (code: string[]) => void
}

/**
 * 8 single-digit boxes: digits only, auto-advance on input, backspace on an
 * empty box moves back, pasting distributes the digits and focuses the last
 * filled box. The first box is focused on mount.
 */
export default function OtpInput({ code, onChange }: OtpInputProps) {
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
    onChange(newCode)

    // Auto-advance to next input
    if (value && index < OTP_LENGTH - 1) {
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === 0) return

    const newCode = [...code]
    for (let i = 0; i < OTP_LENGTH; i++) {
      newCode[i] = pasted[i] || ''
    }
    onChange(newCode)

    // Focus last filled input or submit if all filled
    const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1
    inputRefs.current[lastIndex]?.focus()
  }

  return (
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
  )
}
