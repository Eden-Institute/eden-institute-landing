/** Best-effort human string from an unknown thrown value (PostgrestError, Error, string). */
export function getErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/**
 * Message safe to show a customer. PostgREST / Postgres errors carry a `code` and their text
 * names tables, columns and constraints, so they get the generic sentence (already shipped in
 * AuthForm) and the detail goes to the console. Plain Errors thrown by our own code pass through.
 */
export function getUserFacingErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    console.error(err);
    return "Something went wrong. Please try again.";
  }
  return getErrorMessage(err);
}
