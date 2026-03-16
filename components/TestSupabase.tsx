"use client"

import { useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase"

export default function TestSupabase() {

  useEffect(() => {
    async function test() {

    const supabase = getSupabaseClient()
    if (!supabase) {
      console.error("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.")
      return
    }
    const { data, error } = await supabase
        .from("posts")
        .select("*")

      console.log("DATA:", data)
      console.log("ERROR:", error)

    }

    test()
  }, [])

  return <div>Testing Supabase...</div>
}
