// AI-generated code for "deleting" an object so it can't be reused (normally).
export function deleteSelf<T extends object>(obj: T): void {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (obj as any)[key];
      if (typeof value === 'object' && value !== null) {
        Object.defineProperty(obj, key, {
          value: undefined,
          writable: true,
          configurable: true
        });
      } else if (typeof value !== 'string' && typeof value !== 'symbol') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (obj as any)[key] = undefined;
      }
    }
  }
}