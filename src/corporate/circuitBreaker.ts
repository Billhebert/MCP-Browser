interface CircuitState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const circuits = new Map<string, CircuitState>();
const THRESHOLD = 5;
const RESET_TIMEOUT = 30000;
const HALF_OPEN_MAX = 1;

export async function circuitCall<T>(
  name: string,
  fn: () => Promise<T>,
  fallback?: () => Promise<T>,
): Promise<T> {
  let state = circuits.get(name);
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: "closed" };
    circuits.set(name, state);
  }

  if (state.state === "open") {
    if (Date.now() - state.lastFailure > RESET_TIMEOUT) {
      state.state = "half-open";
    } else {
      if (fallback) return fallback();
      throw new Error(`Circuit breaker open for ${name}`);
    }
  }

  try {
    const result = await fn();
    state.failures = 0;
    state.state = "closed";
    return result;
  } catch (err) {
    state.failures++;
    state.lastFailure = Date.now();
    if (state.failures >= THRESHOLD) {
      state.state = "open";
    }
    throw err;
  }
}
