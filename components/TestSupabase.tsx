"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function TestSupabase() {

  useEffect(() => {
    async function test() {

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