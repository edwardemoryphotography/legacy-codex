interface ResultWithError {
  error: { message: string } | null;
}

export function firstResultError(
  results: readonly ResultWithError[]
): ResultWithError["error"] {
  return results.find((result) => result.error)?.error ?? null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
