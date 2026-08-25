/** Utilidades para el identificador publico `Nombre#Codigo`. */

export interface ParsedHandle {
  name: string;
  code: string;
}

const HANDLE_RE = /^\s*(.+?)\s*#\s*(\d{4})\s*$/;

export function parseHandle(input: string): ParsedHandle | null {
  const match = HANDLE_RE.exec(input);
  if (!match) return null;
  const name = match[1].trim();
  if (name.length < 2 || name.length > 32) return null;
  return { name, code: match[2] };
}

export function isValidHandle(input: string): boolean {
  return parseHandle(input) !== null;
}
