"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Auth() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) alert(error.message)
    else alert("Usuario creado")
  }

  const signIn = async () => {
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