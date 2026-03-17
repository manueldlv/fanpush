"use client"

import { getSupabaseClient } from "@/lib/supabase"

export default function UploadPhoto() {

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0]

    if (!file) return

    const fileName = Date.now() + "-" + file.name

    const supabase = getSupabaseClient()
    if (!supabase) {
      console.error("Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY.")
      return
    }
    const { data, error } = await supabase.storage
      .from("Imagenes")
      .upload(fileName, file)

    console.log(data, error)
  }

  return <input type="file" onChange={upload} />
}
