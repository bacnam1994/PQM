/**
 * Removes undefined values from an object
 * Useful for Firebase updates where undefined values can cause issues
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  
  return result as T;
}

export default removeUndefined;

