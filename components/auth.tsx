"use client"

import { useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"

export default function Auth() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const signUp = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      alert("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.")
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) alert(error.message)
    else alert("Usuario creado")
  }

  const signIn = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      alert("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.")
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) alert(error.message)
  }

  return (
    <div>
      <input
        placeholder="email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={signUp}>Registrarse</button>
      <button onClick={signIn}>Login</button>
    </div>
  )
}
