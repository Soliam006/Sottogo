/** Concatena clases condicionalmente (sustituye a clsx sin dependencias). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
