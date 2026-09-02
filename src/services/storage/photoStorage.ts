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

/** Un ano, en segundos. Ver el comentario de la subida. */
const IMMUTABLE_CACHE_CONTROL = "31536000";

/**
 * Lado mas largo de la imagen que se guarda. Una foto de movil ronda los
 * 4032x3024; se guarda como 2048x1536.
 *
 * El unico sitio donde la aplicacion ensena la foto grande es el visor a
 * pantalla completa: un movil de 430 px a 3x pide ~1290 px reales. Por encima
 * de 2048 se estarian guardando pixeles que nadie llega a ver.
 */
const DISPLAY_MAX_EDGE = 2048;
const THUMB_MAX_EDGE = 480;
const QUALITY = 0.82;

/**
 * Por debajo de esto no se toca el archivo. Reencodar una imagen que ya es
 * pequena solo anade perdida de calidad sin ahorrar nada.
 */
const KEEP_ORIGINAL_MAX_BYTES = 1024 * 1024;

export interface PreparedUpload {
  storagePath: string;
  thumbPath: string | null;
  width: number;
  height: number;
  takenAt: string | null;
}

export class PhotoStorageError extends Error {}

/**
 * Sube la imagen y su miniatura, ambas generadas en el navegador.
 *
 * El archivo que llega del movil NO se sube tal cual: se reduce a
 * `DISPLAY_MAX_EDGE` antes de salir del dispositivo. Una foto de 4 MB se queda
 * en ~400 KB, y eso se nota tres veces: en lo que ocupa el bucket, en lo que
 * tarda la subida con datos moviles y en lo que se descarga cada vez que
 * alguien abre el visor.
 */
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
  const bitmap = await loadImage(file);

  try {
    const display = await prepareDisplayImage(file, bitmap);
    const storagePath = `${tripId}/${id}.${extensionForType(display.type, file)}`;

    const stored = await db.storage
      .from(BUCKET)
      .upload(storagePath, display.blob, {
        contentType: display.type,
        upsert: false,
        // La ruta lleva un UUID y nunca se sobrescribe (`upsert: false`), asi
        // que el contenido de una direccion es inmutable: el navegador puede
        // quedarselo sin volver a preguntar.
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
    if (stored.error) throw new PhotoStorageError(stored.error.message);

    let thumbPath: string | null = null;
    try {
      const thumb = await encodeAt(bitmap, THUMB_MAX_EDGE, outputType());
      thumbPath = `${tripId}/thumbs/${id}.${extensionForType(thumb.type, file)}`;
      const uploaded = await db.storage
        .from(BUCKET)
        .upload(thumbPath, thumb.blob, {
          contentType: thumb.type,
          upsert: false,
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
      if (uploaded.error) thumbPath = null;
    } catch {
      thumbPath = null; // La galeria caera a la imagen grande si no hay miniatura.
    }

    return {
      storagePath,
      thumbPath,
      // Las dimensiones son las de lo que SE GUARDA, no las del archivo que
      // eligio el usuario: describen lo que se va a servir.
      width: display.width,
      height: display.height,
      takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    };
  } finally {
    // Una tanda de 20 fotos dejaria 20 bitmaps descomprimidos en memoria.
    bitmap.close();
  }
}

export interface EncodedImage {
  blob: Blob;
  type: string;
  width: number;
  height: number;
}

/**
 * La imagen tal y como se va a guardar.
 *
 * Se deja intacta solo si ya es pequena en las dos dimensiones: lado y peso.
 * Una captura de pantalla de 1500x1000 puede pesar 8 MB, y esa tambien
 * interesa reencodarla aunque no haya que reducirla.
 *
 * Exportada para poder medirla sin subir nada.
 */
export async function prepareDisplayImage(file: File, bitmap: ImageBitmap): Promise<EncodedImage> {
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const fits = longestEdge <= DISPLAY_MAX_EDGE && file.size <= KEEP_ORIGINAL_MAX_BYTES;

  if (fits) {
    return { blob: file, type: file.type, width: bitmap.width, height: bitmap.height };
  }
  return encodeAt(bitmap, DISPLAY_MAX_EDGE, outputType());
}

/** Dibuja el bitmap a la medida pedida y lo codifica. */
export async function encodeAt(
  bitmap: ImageBitmap,
  maxEdge: number,
  type: string,
): Promise<EncodedImage> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoStorageError("Canvas no disponible");
  // Al reducir a menos de la mitad, el remuestreo por defecto deja dentadas las
  // lineas finas (rotulos, cables, ramas).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob) throw new PhotoStorageError("No se ha podido procesar la imagen.");

  // Si el navegador no sabe codificar el formato pedido, devuelve un PNG.
  return { blob, type: blob.type || type, width, height };
}

let webpSupport: boolean | null = null;

/**
 * WebP cuando el navegador sabe codificarlo: pesa entre un 25 % y un 30 % menos
 * que JPEG a la misma calidad. Si no, JPEG, que lo entiende cualquiera.
 */
export function outputType(): string {
  if (webpSupport === null) {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpSupport = probe.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport ? "image/webp" : "image/jpeg";
}

function extensionForType(type: string, file: File): string {
  const fromType = type.split("/")[1];
  if (fromType && /^[a-z0-9]{2,5}$/.test(fromType)) return fromType;
  return extensionFor(file);
}

export async function removePhotoFiles(db: SupabaseClient, photo: Photo): Promise<void> {
  const paths = [photo.storagePath, photo.thumbPath].filter(Boolean) as string[];
  if (!paths.length) return;

  for (const path of paths) signedUrls.delete(path);
  await db.storage.from(BUCKET).remove(paths);
}

/* ---------------------------------------------------------------------------
   CACHE DE URLs FIRMADAS

   Cada llamada a `createSignedUrls` devuelve un token nuevo, asi que la misma
   foto llegaba con una direccion distinta cada vez. Para el navegador eso es
   otro recurso: su cache fallaba y volvia a descargar las miniaturas enteras en
   cada refresco, cada cambio de pestana y cada vez que alguien del viaje subia
   una foto (el tiempo real refresca a todos).

   Reutilizando la firma mientras siga viva, el navegador reconoce la direccion
   y sirve la imagen de su disco: cero bytes.

   Solo en memoria, a proposito. Una URL firmada da acceso al objeto a quien la
   tenga, y guardarla en el almacenamiento del navegador alargaria su vida mas
   alla de la pestana sin ganar gran cosa.
   --------------------------------------------------------------------------- */

interface SignedUrl {
  url: string;
  /** Momento en el que deja de servir, en milisegundos. */
  expiresAt: number;
}

const signedUrls = new Map<string, SignedUrl>();

/**
 * Margen antes de caducar. Sin el, una URL a punto de expirar podria pedirse
 * justo despues de vencer y dar un 400 en mitad de la galeria.
 */
const RENEW_BEFORE_MS = 5 * 60 * 1000;

function cachedUrl(path: string): string | undefined {
  const hit = signedUrls.get(path);
  if (!hit) return undefined;

  if (hit.expiresAt - RENEW_BEFORE_MS <= Date.now()) {
    signedUrls.delete(path);
    return undefined;
  }
  return hit.url;
}

/** Solo se recorre cuando hay firmas nuevas, no en cada lectura. */
function forgetExpired(): void {
  const now = Date.now();
  for (const [path, entry] of signedUrls) {
    if (entry.expiresAt <= now) signedUrls.delete(path);
  }
}

/**
 * Resuelve URLs firmadas y las adjunta a los objetos de dominio.
 *
 * Solo se piden las que no estan en cache, asi que abrir la galeria por
 * segunda vez no firma nada.
 */
export async function attachSignedUrls(db: SupabaseClient, photos: Photo[]): Promise<Photo[]> {
  if (!photos.length) return photos;

  const paths = new Set<string>();
  for (const p of photos) {
    paths.add(p.storagePath);
    if (p.thumbPath) paths.add(p.thumbPath);
  }

  const missing = [...paths].filter((path) => cachedUrl(path) === undefined);

  if (missing.length) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);

    if (!error && data) {
      const expiresAt = Date.now() + SIGNED_URL_TTL * 1000;
      for (const entry of data) {
        if (entry.path && entry.signedUrl) {
          signedUrls.set(entry.path, { url: entry.signedUrl, expiresAt });
        }
      }
      forgetExpired();
    }
    // Si la firma falla, las que ya estaban en cache siguen sirviendo y las
    // nuevas se quedan sin direccion: la cuadricula ensena su hueco en vez de
    // vaciarse entera, que es lo que pasaba antes.
  }

  return photos.map((p) => ({
    ...p,
    url: cachedUrl(p.storagePath),
    thumbUrl: (p.thumbPath ? cachedUrl(p.thumbPath) : undefined) ?? cachedUrl(p.storagePath),
  }));
}

/** Vacia la cache. Al cerrar sesion no deben quedar firmas del viaje anterior. */
export function forgetSignedUrls(): void {
  signedUrls.clear();
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "jpg";
}

/**
 * Decodifica APLICANDO la orientacion EXIF.
 *
 * Imprescindible ahora que la imagen se reencoda: el canvas no conserva los
 * metadatos, asi que una foto vertical cuyo EXIF decia "girada 90 grados" se
 * guardaria tumbada para siempre. Las miniaturas ya arrastraban este defecto:
 * se generaban por canvas y podian salir giradas respecto al original.
 */
export async function loadImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoStorageError("No se ha podido leer la imagen.");
  }
}
