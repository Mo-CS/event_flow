import { supabase } from "../lib/supabase"
import type { FileItem } from "../types"

function mapFile(f: Record<string, any>): FileItem {
  return {
    id: f.id,
    name: f.name,
    url: f.url,
    type: f.type,
    size: f.size,
    uploadedBy: f.uploaded_by,
    createdAt: f.created_at,
  }
}

export async function getFiles(): Promise<FileItem[]> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapFile)
}

export async function getFileById(id: string): Promise<FileItem | undefined> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapFile(data) : undefined
}

export async function uploadFile(
  name: string,
  type: string,
  size: number,
  uploadedBy: string,
  file?: File,
): Promise<FileItem> {
  let url = "/placeholder.svg"

  if (file) {
    const bucket = type.startsWith("image/") ? "uploads" : "uploads"
    const filePath = `${Date.now()}-${name}`
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)
      url = publicUrl.publicUrl
    }
  }

  const { data, error } = await supabase
    .from("files")
    .insert({ name, url, type, size, uploaded_by: uploadedBy })
    .select()
    .single()
  if (error) throw error
  return mapFile(data)
}

export async function deleteFile(id: string): Promise<boolean> {
  const { data: file } = await supabase
    .from("files")
    .select("name")
    .eq("id", id)
    .single()

  if (file) {
    await supabase.storage.from("uploads").remove([file.name])
  }

  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", id)
  if (error) throw error
  return true
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/")
}
