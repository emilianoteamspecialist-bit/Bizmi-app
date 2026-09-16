export type FileBase64 = {
  dataUrl: string
  data: string
  mimeType: string
  fileName: string
}

export function fileToBase64(file: File): Promise<FileBase64> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const data = dataUrl.slice(dataUrl.indexOf(",") + 1)
      resolve({ dataUrl, data, mimeType: file.type, fileName: file.name })
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}
