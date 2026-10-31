/**
 * Writes bytes or text in the URL-safe base64 alphabet, without padding.
 *
 * @param value - What to write.
 * @returns The encoding.
 */
const base64url = (value: string | Uint8Array): string => Buffer.from(value).toString('base64url');

export { base64url };
