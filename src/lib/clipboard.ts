/**
 * Copiar al portapapeles.
 *
 * `navigator.clipboard` solo existe en contexto seguro (https o localhost), asi
 * que sobre http —abriendo la app desde el movil por IP, por ejemplo— no esta.
 * De ahi el plan B con un textarea temporal: `execCommand` esta obsoleto pero
 * sigue funcionando y es la diferencia entre que el boton sirva o no fuera de
 * https.
 *
 * Devuelve si se copio de verdad; el llamante decide que decir. Nunca hay que
 * dar por hecho que salio bien.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Sin permiso o sin foco: se intenta el plan B.
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Fuera de la vista y sin robar el scroll ni el zoom en movil.
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    document.body.removeChild(area);
    return done;
  } catch {
    return false;
  }
}
