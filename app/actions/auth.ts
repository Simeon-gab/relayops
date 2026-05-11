'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const userId = data.user.id
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.role) {
    await supabase.auth.signOut()
    redirect('/sign-in?error=no_role')
  }

  if (profile.role === 'dealer') {
    redirect('/portal')
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
