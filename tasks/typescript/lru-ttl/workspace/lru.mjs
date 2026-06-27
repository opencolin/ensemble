// Implement an LRU cache with optional per-entry TTL.
// Export `LRUCache`. See task prompt for the exact contract.
//
// The acceptance test injects a fake clock via `options.now`; call it every
// time you need the current time (do not cache it).

export class LRUCache {
  constructor(capacity, options = {}) {
    // TODO: implement
  }

  set(key, value, ttlMs) {
    // TODO: implement
    throw new Error("not implemented");
  }

  get(key) {
    // TODO: implement
    return undefined;
  }

  peek(key) {
    // TODO: implement
    return undefined;
  }

  has(key) {
    // TODO: implement
    return false;
  }

  delete(key) {
    // TODO: implement
    return false;
  }

  ttl(key) {
    // TODO: implement
    return undefined;
  }

  get size() {
    // TODO: implement
    return 0;
  }
}
