/**
 * Checks if a value is safe for SSR dehydration (JSON serializable).
 * Returns true if the value is a POJO, array, or primitive (excluding function/symbol).
 */
export function isSerializable(value: unknown): boolean {
  const seen = new Set<unknown>();

  function check(val: unknown): boolean {
    if (val === null || typeof val !== 'object') {
      return typeof val !== 'function' && typeof val !== 'symbol';
    }

    if (seen.has(val)) return false; // Circular reference
    seen.add(val);

    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== Array.prototype) {
      return false; // Class instance or special object
    }

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (!check(val[i])) return false;
      }
    } else {
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          if (!check((val as any)[key])) return false;
        }
      }
    }

    return true;
  }

  return check(value);
}

/**
 * Development helper to check if a value is safe for SSR dehydration.
 * Issues console warnings with detailed paths for non-serializable parts.
 *
 * @internal
 */
export function validateSerializable(value: unknown, providerName: string, path = ''): void {
  const seen = new Set<unknown>();

  function check(val: unknown, currentPath: string): void {
    if (val === null || typeof val !== 'object') {
      if (typeof val === 'function' || typeof val === 'symbol') {
        console.warn(
          `[River SSR] Provider "${providerName}" contains a non-serializable value (${typeof val}) at path "${
            currentPath || '(root)'
          }". This will be lost during dehydration.`,
        );
      }
      return;
    }

    if (seen.has(val)) {
      console.warn(
        `[River SSR] Provider "${providerName}" contains a circular reference at path "${
          currentPath || '(root)'
        }". Dehydration might fail.`,
      );
      return;
    }
    seen.add(val);

    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== Array.prototype) {
      console.warn(
        `[River SSR] Provider "${providerName}" contains a class instance or special object (${
          proto?.constructor?.name ?? 'unknown'
        }) at path "${currentPath || '(root)'}". Methods and prototype will be lost after hydration.`,
      );
    }

    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        check(val[i], `${currentPath}[${i}]`);
      }
    } else {
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          check((val as any)[key], currentPath ? `${currentPath}.${key}` : key);
        }
      }
    }
  }

  check(value, path);
}
