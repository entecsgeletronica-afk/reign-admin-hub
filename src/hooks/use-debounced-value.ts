import * as React from "react";

/**
 * Returns a debounced copy of `value`. Updates after `delayMs` of inactivity.
 * Useful for search inputs to avoid recomputing/refetching on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
