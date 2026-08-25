export function errorMessage(error: unknown, fallback = "Algo ha salido mal."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
