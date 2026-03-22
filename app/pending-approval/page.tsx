'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PendingApprovalPage() {
  const { user } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg className="h-7 w-7 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Cont în așteptare</CardTitle>
          <CardDescription className="mt-2">
            Contul tău a fost creat cu succes, dar trebuie aprobat de un administrator înainte de a putea folosi platforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-center text-muted-foreground bg-muted/50 rounded-lg p-4">
            <p>Vei primi acces în curând. Poți reveni oricând pentru a verifica statusul.</p>
            {user?.email && (
              <p className="mt-2 font-medium text-foreground">{user.email}</p>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            Deconectează-te
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
