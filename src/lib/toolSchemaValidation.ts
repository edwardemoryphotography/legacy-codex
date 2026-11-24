// Structural validation for the JSON-Schema subset used by the review tool.
// The provider boundary uses this so a text answer must be *schema-shaped*, not
// merely carry the required keys. It is not a general JSON-Schema engine:
// unsupported keywords are treated as unknown, never as a pass for a known
// mismatch. Error strings name paths only, never values.
export type ToolSchema = Record<string, unknown>

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

export function validateToolInput(value: unknown, schema: ToolSchema, path = '$'): string | null {
  const anyOf = schema.anyOf as ToolSchema[] | undefined
  if (Array.isArray(anyOf)) {
    let first: string | null = null
    for (const option of anyOf) {
      const error = validateToolInput(value, option, path)
      if (error === null) return null
      first ??= error
    }
    return first ?? `${path} does not match an allowed shape`
  }
  const expected = schema.type
  if (typeof expected === 'string') {
    const actual = typeOf(value)
    const compatible = expected === 'number' ? actual === 'number' || actual === 'integer' : actual === expected
    if (!compatible) return `${path} must be ${expected}`
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.some(option => option === value) ? null : `${path} is not an allowed value`
  }
  if (expected === 'object' || schema.properties) {
    if (typeOf(value) !== 'object') return `${path} must be object`
    const record = value as Record<string, unknown>
    const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : []
    for (const key of required) if (!Object.prototype.hasOwnProperty.call(record, key)) return `${path}.${key} is required`
    const properties = (schema.properties ?? {}) as Record<string, ToolSchema>
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) if (!(key in properties)) return `${path}.${key} is not allowed`
    }
    for (const [key, child] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue
      const error = validateToolInput(record[key], child, `${path}.${key}`)
      if (error) return error
    }
    return null
  }
  if (expected === 'array') {
    if (!Array.isArray(value)) return `${path} must be array`
    const min = typeof schema.minItems === 'number' ? schema.minItems : undefined
    const max = typeof schema.maxItems === 'number' ? schema.maxItems : undefined
    if (min !== undefined && value.length < min) return `${path} has too few items`
    if (max !== undefined && value.length > max) return `${path} has too many items`
    if (schema.items) for (let index = 0; index < value.length; index += 1) {
      const error = validateToolInput(value[index], schema.items as ToolSchema, `${path}[${index}]`)
      if (error) return error
    }
    return null
  }
  if (expected === 'string') {
    if (typeof value !== 'string') return `${path} must be string`
    const min = typeof schema.minLength === 'number' ? schema.minLength : undefined
    const max = typeof schema.maxLength === 'number' ? schema.maxLength : undefined
    if (min !== undefined && value.length < min) return `${path} is too short`
    if (max !== undefined && value.length > max) return `${path} is too long`
  }
  return null
}
