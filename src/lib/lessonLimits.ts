// Exceptions are part of a lesson’s meaning, regardless of its origin.
// Reject malformed saved limits rather than silently broadening the rule.
export function lessonExceptionFields(value: { exceptions?: unknown }): { exceptions?: string } {
  if (value.exceptions === undefined) return {}
  if (typeof value.exceptions !== 'string' || !value.exceptions.trim() || value.exceptions.length > 800) {
    throw new Error('The lesson’s exceptions could not be reconstructed.')
  }
  return { exceptions: value.exceptions.trim() }
}
