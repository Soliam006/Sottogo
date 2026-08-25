"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Photo, UUID } from "@/core/models";

/**
 * Almacenamiento de fotografias.
 *
 * Las imagenes NO se guardan en la base de datos: van a un bucket privado
 * (`trip-media`) y la tabla `photos` solo conserva la ruta + metadatos.
 * La lectura se hace con URLs firmadas de corta duracion.
 */
export const BUCKET = "trip-media";
const SIGNED_URL_TTL = 60 * 60; // 1 h
const THUMB_MAX_EDGE = 480;

export interface PreparedUpload {
  storagePath: string;
  thumbPath: string | null;
  width: number;
  height: number;
  takenAt: string | null;
}

export class PhotoStorageError extends Error {}

/** Sube el original + una miniatura generada en el navegador. */
export async function uploadPhotoFile(
  db: SupabaseClient,
  tripId: UUID,
  file: File,
): Promise<PreparedUpload> {
  if (!file.type.startsWith("image/")) {
    throw new PhotoStorageError("El archivo debe ser una imagen.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new PhotoStorageError("La imagen supera el límite de 15 MB.");
  }

  const id = crypto.randomUUID();
  const ext = extensionFor(file);
  const storagePath = `${tripId}/${id}.${ext}`;

  const bitmap = await loadImage(file);
  const { width, height } = bitmap;

  const original = await db.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (original.error) throw new PhotoStorageError(original.error.message);

  let thumbPath: string | null = null;
  try {
    const thumbBlob = await createThumbnail(bitmap);
    thumbPath = `${tripId}/thumbs/${id}.jpg`;
    const thumb = await db.storage
      .from(BUCKET)
      .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: false });
    if (thumb.error) thumbPath = null;
  } catch {
    thumbPath = null; // La galeria caera al original si no hay miniatura.
  }

  return {
    storagePath,
    thumbPath,
    width,
    height,
    takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  };
}

export async function removePhotoFiles(db: SupabaseClient, photo: Photo): Promise<void> {
  const paths = [photo.storagePath, photo.thumbPath].filter(Boolean) as string[];
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
}

/** Resuelve URLs firmadas en lote y las adjunta a los objetos de dominio. */
export async function attachSignedUrls(db: SupabaseClient, photos: Photo[]): Promise<Photo[]> {
  if (!photos.length) return photos;

  const paths = new Set<string>();
  for (const p of photos) {
    paths.add(p.storagePath);
    if (p.thumbPath) paths.add(p.thumbPath);
  }

  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrls([...paths], SIGNED_URL_TTL);

  if (error || !data) return photos;

  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }

  return photos.map((p) => ({
    ...p,
    url: urls.get(p.storagePath),
    thumbUrl: (p.thumbPath ? urls.get(p.thumbPath) : undefined) ?? urls.get(p.storagePath),
  }));
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "jpg";
}

async function loadImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new PhotoStorageError("No se ha podido leer la imagen.");
  }
}

async function createThumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoStorageError("Canvas no disponible");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoStorageError("Miniatura fallida"))),
      "image/jpeg",
      0.82,
    );
  });
}
