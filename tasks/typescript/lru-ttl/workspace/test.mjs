// Acceptance test for LRUCache with TTL. Do not modify. Run with `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LRUCache } from "./lru.mjs";

// Fake clock helpers. Each test builds its own cache with its own clock so the
// cases are fully independent.
function makeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    set: (v) => {
      t = v;
    },
    advance: (d) => {
      t += d;
    },
  };
}

test("basic set/get", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("missing"), undefined);
});

test("size counts entries", () => {
  const c = new LRUCache(3);
  assert.equal(c.size, 0);
  c.set("a", 1);
  assert.equal(c.size, 1);
  c.set("b", 2);
  assert.equal(c.size, 2);
});

test("update replaces value", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("a", 99);
  assert.equal(c.get("a"), 99);
  assert.equal(c.size, 1);
});

test("eviction removes least-recently-used", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.set("c", 3); // evicts "a"
  assert.equal(c.get("a"), undefined);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
  assert.equal(c.size, 2);
});

test("get refreshes recency so a different key is evicted", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.get("a"), 1); // "a" now most recent
  c.set("c", 3); // should evict "b", not "a"
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
});

test("set on existing key refreshes recency and updates value", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.set("a", 10); // update + most recent
  c.set("c", 3); // evicts "b"
  assert.equal(c.get("a"), 10);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
});

test("peek does not refresh recency (verified via eviction)", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.peek("a"), 1); // peek must NOT make "a" recent
  c.set("c", 3); // "a" is still LRU -> evicted
  assert.equal(c.get("a"), undefined);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
});

test("peek returns value without affecting order", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.peek("b"), 2);
  assert.equal(c.peek("missing"), undefined);
  assert.equal(c.size, 2);
});

test("has does not refresh recency (verified via eviction)", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.has("a"), true); // must NOT make "a" recent
  c.set("c", 3); // "a" is still LRU -> evicted
  assert.equal(c.has("a"), false);
  assert.equal(c.has("b"), true);
  assert.equal(c.has("c"), true);
});

test("has returns false for missing key", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  assert.equal(c.has("a"), true);
  assert.equal(c.has("nope"), false);
});

test("delete returns true then false", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  assert.equal(c.delete("a"), true);
  assert.equal(c.delete("a"), false);
  assert.equal(c.get("a"), undefined);
  assert.equal(c.size, 0);
});

test("delete of absent key returns false", () => {
  const c = new LRUCache(2);
  assert.equal(c.delete("ghost"), false);
});

test("numeric keys and capacity 1", () => {
  const c = new LRUCache(1);
  c.set(1, "one");
  assert.equal(c.get(1), "one");
  c.set(2, "two");
  assert.equal(c.get(1), undefined);
  assert.equal(c.get(2), "two");
  assert.equal(c.size, 1);
});

test("now is read from injected clock, never cached", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 100); // expires at 1100
  clock.set(1099);
  assert.equal(c.get("a"), 1);
  clock.set(1100);
  assert.equal(c.get("a"), undefined); // boundary is expired
});

test("expiry boundary is inclusive (now >= t + d)", () => {
  const clock = makeClock(0);
  const c = new LRUCache(5, { now: clock.now });
  c.set("k", "v", 50); // expires at 50
  clock.set(49);
  assert.equal(c.get("k"), "v");
  clock.set(50);
  assert.equal(c.get("k"), undefined);
});

test("get on expired entry returns undefined", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(10);
  assert.equal(c.get("a"), undefined);
});

test("peek honors expiry", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(5);
  assert.equal(c.peek("a"), 1);
  clock.advance(5); // now at +10 -> expired
  assert.equal(c.peek("a"), undefined);
});

test("has honors expiry", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(9);
  assert.equal(c.has("a"), true);
  clock.advance(1); // +10 -> expired
  assert.equal(c.has("a"), false);
});

test("delete of expired entry returns false", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(10);
  assert.equal(c.delete("a"), false);
});

test("size excludes expired entries", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  c.set("b", 2, 100);
  assert.equal(c.size, 2);
  clock.advance(10); // "a" expired, "b" still live
  assert.equal(c.size, 1);
});

test("size is 0 after all entries expire", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 10);
  c.set("b", 2, 20);
  clock.advance(20);
  assert.equal(c.size, 0);
});

test("ttl returns remaining time before expiry", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 100); // expires at 1100
  assert.equal(c.ttl("a"), 100);
  clock.advance(30);
  assert.equal(c.ttl("a"), 70);
});

test("ttl is undefined at and after expiry", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 100); // expires at 1100
  clock.set(1100);
  assert.equal(c.ttl("a"), undefined); // exactly at expiry
  clock.set(1200);
  assert.equal(c.ttl("a"), undefined); // past expiry
});

test("ttl is undefined for an entry with no TTL", () => {
  const c = new LRUCache(5);
  c.set("a", 1); // no ttl
  assert.equal(c.ttl("a"), undefined);
});

test("ttl is undefined for absent key", () => {
  const c = new LRUCache(5);
  assert.equal(c.ttl("missing"), undefined);
});

test("ttl does not change recency", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(2, { now: clock.now });
  c.set("a", 1, 100);
  c.set("b", 2, 100);
  assert.equal(c.ttl("a"), 100); // must NOT refresh "a"
  c.set("c", 3); // "a" still LRU -> evicted
  assert.equal(c.get("a"), undefined);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
});

test("set without ttl never expires", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1); // no ttl
  clock.advance(1_000_000);
  assert.equal(c.get("a"), 1);
  assert.equal(c.has("a"), true);
});

test("set with new ttl resets expiry", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 100); // expires at 1100
  clock.set(1050);
  c.set("a", 2, 100); // reset: now expires at 1150
  clock.set(1149);
  assert.equal(c.get("a"), 2);
  clock.set(1150);
  assert.equal(c.get("a"), undefined);
});

test("updating an entry without ttl clears a previous ttl", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(5, { now: clock.now });
  c.set("a", 1, 100); // expires at 1100
  c.set("a", 2); // no ttl now -> never expires
  clock.set(5000);
  assert.equal(c.get("a"), 2);
  assert.equal(c.ttl("a"), undefined);
});

test("expired entries are purged so a new insert does not evict a live one", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(2, { now: clock.now });
  c.set("a", 1, 10); // will expire
  c.set("b", 2); // live, no ttl
  clock.advance(10); // "a" expired, "b" still live
  c.set("c", 3); // should reclaim "a"'s slot, NOT evict "b"
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
  assert.equal(c.get("a"), undefined);
  assert.equal(c.size, 2);
});

test("expired entry is never the reason a live entry is evicted (full cache)", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(3, { now: clock.now });
  c.set("a", 1); // live (oldest, but live)
  c.set("b", 2, 10); // will expire
  c.set("c", 3); // live
  clock.advance(10); // "b" expired
  c.set("d", 4); // reclaim "b", keep "a" and "c"
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("c"), 3);
  assert.equal(c.get("d"), 4);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.size, 3);
});

test("eviction falls back to LRU when nothing is expired", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(2, { now: clock.now });
  c.set("a", 1, 1000); // live
  c.set("b", 2, 1000); // live
  c.set("c", 3, 1000); // nothing expired -> evict LRU "a"
  assert.equal(c.get("a"), undefined);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
  assert.equal(c.size, 2);
});

test("re-inserting an expired key works and is live again", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(2, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(10); // expired
  c.set("a", 2, 10); // re-insert
  assert.equal(c.get("a"), 2);
  assert.equal(c.has("a"), true);
});

test("get of expired entry removes it (does not linger)", () => {
  const clock = makeClock(1000);
  const c = new LRUCache(3, { now: clock.now });
  c.set("a", 1, 10);
  clock.advance(10);
  assert.equal(c.get("a"), undefined);
  // After the failed get, "a" must be gone, so size reflects only live entries.
  assert.equal(c.size, 0);
  assert.equal(c.has("a"), false);
});
