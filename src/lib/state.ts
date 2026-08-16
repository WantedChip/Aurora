/**
 * Aurora URL Hash & Parameter State Serialization Engine
 * 
 * Provides bi-directional synchronization between URL hash routes, query parameters,
 * and room simulation parameter state objects.
 */

export interface ParsedRouteState {
  roomId: string | null;
  params: Record<string, string>;
  rawQuery: string;
}

/**
 * Parses the browser location hash (or an arbitrary hash string).
 * Examples:
 *   "" -> { roomId: null, params: {}, rawQuery: "" }
 *   "#/" -> { roomId: null, params: {}, rawQuery: "" }
 *   "#/physarum" -> { roomId: "physarum", params: {}, rawQuery: "" }
 *   "#/physarum?seed=A8F29&decay=0.96" -> { roomId: "physarum", params: { seed: "A8F29", decay: "0.96" }, rawQuery: "seed=A8F29&decay=0.96" }
 */
export function parseHash(hashInput?: string): ParsedRouteState {
  const hash = (hashInput !== undefined ? hashInput : (typeof window !== 'undefined' ? window.location.hash : '')) || '';
  
  // Strip leading '#' or '#/'
  let cleaned = hash.replace(/^#\/?/, '');
  if (!cleaned || cleaned === '/') {
    return { roomId: null, params: {}, rawQuery: '' };
  }

  // Separate path from query string
  const questionIndex = cleaned.indexOf('?');
  let roomPath = questionIndex >= 0 ? cleaned.slice(0, questionIndex) : cleaned;
  const rawQuery = questionIndex >= 0 ? cleaned.slice(questionIndex + 1) : '';

  // Clean trailing slashes from roomId
  roomPath = roomPath.replace(/^\/+|\/+$/g, '');
  const roomId = roomPath.length > 0 ? roomPath : null;

  const params: Record<string, string> = {};
  if (rawQuery) {
    const searchParams = new URLSearchParams(rawQuery);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { roomId, params, rawQuery };
}

/**
 * Serializes room parameters into a clean URL query string.
 * If defaultParams is provided, parameters equal to default are omitted to produce compact URLs.
 */
export function serializeParams(
  currentParams: Record<string, any>,
  defaultParams?: Record<string, any>,
  includeSeed = true
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(currentParams)) {
    if (value === undefined || value === null) {
      continue;
    }

    // Always include seed if specified
    if (key === 'seed') {
      if (includeSeed) {
        // Strip leading # in URL query parameter for clean formatting
        const cleanSeed = String(value).replace(/^#/, '');
        searchParams.set(key, cleanSeed);
      }
      continue;
    }

    // Skip values identical to default if defaultParams provided
    if (defaultParams && defaultParams[key] !== undefined && defaultParams[key] === value) {
      continue;
    }

    if (typeof value === 'number') {
      // Format floats cleanly without unnecessary trailing zeros
      const rounded = Number.isInteger(value) ? value.toString() : Number(value.toFixed(4)).toString();
      searchParams.set(key, rounded);
    } else if (typeof value === 'boolean') {
      searchParams.set(key, value ? '1' : '0');
    } else {
      searchParams.set(key, String(value));
    }
  }

  const result = searchParams.toString();
  return result;
}

/**
 * Constructs a full hash string (e.g. "#/physarum?seed=A8F29&decay=0.96")
 */
export function serializeHash(
  roomId: string | null,
  params?: Record<string, any>,
  defaultParams?: Record<string, any>
): string {
  if (!roomId) {
    return '#/';
  }

  let hash = `#/${roomId}`;
  if (params && Object.keys(params).length > 0) {
    const queryString = serializeParams(params, defaultParams);
    if (queryString) {
      hash += `?${queryString}`;
    }
  }

  return hash;
}

/**
 * Parses raw string parameter key-value pairs against a typed default parameter schema.
 * Coerces types (number, boolean, string) safely and preserves fallback values for invalid inputs.
 */
export function parseParams<T extends Record<string, any>>(
  rawParams: Record<string, string>,
  defaultParams: T
): T {
  const result: Record<string, any> = { ...defaultParams };

  for (const [key, rawValue] of Object.entries(rawParams)) {
    if (key === 'seed') {
      // Normalize seed format to include leading '#'
      const seedVal = rawValue.startsWith('#') ? rawValue : `#${rawValue}`;
      result[key] = seedVal;
      continue;
    }

    const defaultValue = defaultParams[key];
    if (defaultValue === undefined) {
      // Unmapped parameter: keep raw string
      result[key] = rawValue;
      continue;
    }

    if (typeof defaultValue === 'number') {
      const parsedNum = parseFloat(rawValue);
      if (!Number.isNaN(parsedNum)) {
        result[key] = parsedNum;
      }
    } else if (typeof defaultValue === 'boolean') {
      result[key] = rawValue === '1' || rawValue.toLowerCase() === 'true';
    } else if (typeof defaultValue === 'string') {
      result[key] = rawValue;
    } else {
      result[key] = rawValue;
    }
  }

  return result as T;
}

/**
 * Synchronizes parameter state to the browser address bar cleanly using history.replaceState
 * (or history.pushState if navigation should create a new history entry).
 */
export function syncStateToURL(
  roomId: string | null,
  params?: Record<string, any>,
  defaultParams?: Record<string, any>,
  replaceState = true
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const newHash = serializeHash(roomId, params, defaultParams);
  if (window.location.hash === newHash) {
    return;
  }

  if (replaceState && window.history && window.history.replaceState) {
    const newUrl = window.location.pathname + window.location.search + newHash;
    window.history.replaceState(null, '', newUrl);
  } else {
    window.location.hash = newHash;
  }
}

/**
 * Copies the current shareable URL to the system clipboard.
 */
export async function copyShareableURL(
  roomId: string,
  params?: Record<string, any>,
  defaultParams?: Record<string, any>
): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  const hash = serializeHash(roomId, params, defaultParams);
  const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(fullUrl);
  }

  return fullUrl;
}

/**
 * Frame-rate independent exponential damping for simulation parameters.
 * Calculates exact asymptotic decay towards target value over time delta (in seconds).
 *
 * @param current Current value
 * @param target Target target value
 * @param lambda Damping rate coefficient (higher = faster convergence)
 * @param dt Frame time delta in seconds
 */
export function dampParameter(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
