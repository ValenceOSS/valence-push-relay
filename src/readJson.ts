/**
 * Reads JSON, or nothing where it is not JSON.
 *
 * @param text - The text.
 * @returns What it holds, or null.
 */
const readJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export { readJson };
