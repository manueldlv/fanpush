"use client"

import { supabase } from "@/lib/supabase"

export default function UploadPhoto() {

  const upload = async (e) => {

    const file = e.target.files[0]

    const fileName = Date.now() + "-" + file.name

    const { data, error } = await supabase.storage
      .from("imagenes")
      .upload(fileName, file)

    console.log(data, error)
  }

  return <input type="file" onChange={upload} />
}