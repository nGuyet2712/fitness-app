/**
 * Encodes a keyset of column values into an opaque base64url cursor string
 * for cursor-based pagination. The resulting string is safe to use in URL
 * query parameters without additional encoding.
 *
 * @param values - A record of column name → value pairs that form the pagination keyset.
 * @returns An opaque base64url-encoded cursor string.
 */
export function encodeCursor(values: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(values)).toString('base64url');
}

/**
 * Decodes an opaque base64url cursor string back into its original keyset
 * values. The cursor must have been produced by {@link encodeCursor}.
 *
 * Throws an `Error` with message `'Malformed cursor'` if the string is not
 * valid base64url, does not contain valid JSON, or does not decode to a
 * plain object.
 *
 * @param cursor - The base64url-encoded cursor string from the client.
 * @returns A record of column name → value pairs from the original keyset.
 * @throws {Error} If the cursor cannot be decoded or is not a valid object.
 */
export function decodeCursor(cursor: string): Record<string, string | number> {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Invalid cursor type');
    }
    return parsed as Record<string, string | number>;
  } catch {
    throw new Error('Malformed cursor');
  }
}
