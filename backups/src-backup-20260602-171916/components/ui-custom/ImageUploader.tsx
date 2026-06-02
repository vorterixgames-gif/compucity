'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImagePlus, Loader2, CheckCircle } from 'lucide-react'

interface ImageUploaderProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
}

async function compressImageClient(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Error al convertir la imagen'))
          }
        },
        'image/webp',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Error al cargar la imagen'))
    }

    img.src = url
  })
}

export default function ImageUploader({ images, onChange, maxImages = 6 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lastUploadOk, setLastUploadOk] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError('')
    setLastUploadOk(false)
    const fileArray = Array.from(files)

    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        setUploadError(`${file.name} no es una imagen válida`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name} es muy grande (máx 10MB)`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    const remaining = maxImages - images.length
    if (remaining <= 0) {
      setUploadError(`Máximo ${maxImages} imágenes por producto`)
      return
    }

    const filesToUpload = validFiles.slice(0, remaining)
    setUploading(true)

    const newUrls: string[] = []
    for (let i = 0; i < filesToUpload.length; i++) {
      setUploadProgress(`Comprimiendo imagen ${i + 1} de ${filesToUpload.length}...`)
      try {
        // Compress client-side
        const compressedBlob = await compressImageClient(filesToUpload[i], 1200, 0.8)

        // Create FormData
        const formData = new FormData()
        const webpFile = new File([compressedBlob], filesToUpload[i].name.replace(/\.[^.]+$/, '.webp'), {
          type: 'image/webp',
        })
        formData.append('file', webpFile)

        // Upload
        setUploadProgress(`Subiendo imagen ${i + 1} de ${filesToUpload.length}...`)
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (data.ok && data.url) {
          newUrls.push(data.url)
        } else {
          setUploadError(data.error || 'Error al subir imagen')
        }
      } catch (err: any) {
        setUploadError(err.message || 'Error al procesar la imagen')
      }
    }

    // Update parent state with ALL existing + new URLs
    if (newUrls.length > 0) {
      const allUrls = [...images, ...newUrls]
      onChange(allUrls)
      setLastUploadOk(true)
      setTimeout(() => setLastUploadOk(false), 3000)
    }

    setUploading(false)
    setUploadProgress('')
  }, [images, maxImages, onChange])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const removeImage = async (index: number) => {
    const imageUrl = images[index]
    const newImages = [...images]
    newImages.splice(index, 1)
    onChange(newImages)

    // Delete from database
    try {
      const imageId = imageUrl.replace('/api/image/', '')
      await fetch('/api/admin/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: imageId }),
      })
    } catch {
      // Silently fail
    }
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    const newImages = [...images]
    const [moved] = newImages.splice(from, 1)
    newImages.splice(to, 0, moved)
    onChange(newImages)
  }

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-compucity-green bg-compucity-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-compucity-green animate-spin" />
            <p className="text-sm text-gray-600">{uploadProgress}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              Hacé clic o arrastrá imágenes aquí
            </p>
            <p className="text-xs text-gray-400">
              JPG, PNG, WebP o GIF · Se convierten a WebP · Máx 10MB
            </p>
          </div>
        )}
      </div>

      {/* Success message */}
      {lastUploadOk && (
        <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Imagen subida correctamente
        </p>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{uploadError}</p>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div
              key={url + index}
              className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
            >
              <img
                src={url}
                alt={`Imagen ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-product.png'
                }}
              />

              {/* Main image badge */}
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-compucity-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  PORTADA
                </span>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {index > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); moveImage(index, index - 1) }}
                    className="bg-white/90 hover:bg-white text-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow"
                    title="Mover a la izquierda"
                  >←</button>
                )}
                {index < images.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); moveImage(index, index + 1) }}
                    className="bg-white/90 hover:bg-white text-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow"
                    title="Mover a la derecha"
                  >→</button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(index) }}
                  className="bg-red-500/90 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow"
                  title="Eliminar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Add more button */}
          {images.length < maxImages && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">Agregar</span>
            </button>
          )}
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-gray-400">
        {images.length > 0 
          ? `${images.length} de ${maxImages} imágenes cargadas · La primera es la portada`
          : 'No hay imágenes cargadas · Hacé clic arriba para agregar'
        }
      </p>
    </div>
  )
}
