/**
 * El identificador publico para compartir: `username#0000`.
 *
 * Antes era `Nombre#Codigo`, y eso obligaba al nombre a hacer dos trabajos a la
 * vez: lo que se ensena y la mitad del identificador. Nadie podia poner su
 * nombre completo sin acabar con un `Maria Jose Fernandez#7314`, y peor aun, al
 * cambiarse el nombre cambiaba el identificador con el.
 *
 * El username no es unico por si solo: lo unico es el par con el codigo. Por eso
 * existe el `#0000` y por eso nadie se queda sin el username que quiere.
 */

/** Forma del username, la misma que exige la restriccion de `profiles`. */
export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export interface ParsedHandle {
  username: string;
  code: string;
}

const HANDLE_RE = /^\s*@?([A-Za-z0-9_.]{3,24})\s*#\s*(\d{4})\s*$/;

/**
 * Lee un identificador escrito a mano.
 *
 * Tolera la arroba de delante y las mayusculas porque es lo que la gente teclea
 * cuando lo copia de otro sitio; el username se guarda siempre en minusculas.
 */
export function parseHandle(input: string): ParsedHandle | null {
  const match = HANDLE_RE.exec(input);
  if (!match) return null;
  return { username: match[1].toLowerCase(), code: match[2] };
}

export function isValidHandle(input: string): boolean {
  return parseHandle(input) !== null;
}

/**
 * Normaliza lo que se escribe en el campo de usuario.
 *
 * Se aplica mientras se teclea, asi que no rechaza: convierte. Los acentos se
 * pasan a su letra base en vez de desaparecer, que es lo que hace el trigger de
 * la base de datos: alli "Nino" sale de "Niño" perdiendo la ene entera.
 */
export function normalizeUsername(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
}

/** Que le falta al username para valer. `null` si esta bien. */
export function usernameProblem(input: string): string | null {
  if (input.length < 3) return "El usuario necesita al menos 3 caracteres.";
  if (input.length > 24) return "El usuario no puede pasar de 24 caracteres.";
  if (!USERNAME_RE.test(input)) return "Solo minúsculas, números, guion bajo y punto.";
  return null;
}
