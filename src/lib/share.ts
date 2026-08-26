/**
 * Compartir contenido con la hoja nativa del sistema.
 *
 * `navigator.share` solo existe en contexto seguro (https o localhost) y no en
 * todos los navegadores de escritorio, asi que hay un plan B: copiar el enlace
 * al portapapeles. El llamante decide que mensaje ensena en cada caso.
 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "unavailable";

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function shareContent(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      // El usuario cerro la hoja de compartir: no es un fallo.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Cualquier otro problema cae al portapapeles.
    }
  }

  try {
    await navigator.clipboard.writeText(payload.url);
    return "copied";
  } catch {
    return "unavailable";
  }
}
