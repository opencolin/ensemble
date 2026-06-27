// Acceptance test for LRUCache. Do not modify. Run with `node --test`.
import test from "node:test";
import assert from "node:assert/strict";
import { LRUCache } from "./lru.mjs";

test("basic get/put", () => {
  const c = new LRUCache(2);
  c.put("a", 1);
  c.put("b", 2);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("missing"), undefined);
  assert.equal(c.size, 2);
});

test("evicts least-recently-used", () => {
  const c = new LRUCache(2);
  c.put("a", 1);
  c.put("b", 2);
  c.put("c", 3); // evicts "a"
  assert.equal(c.get("a"), undefined);
  assert.equal(c.get("b"), 2);
  assert.equal(c.get("c"), 3);
  assert.equal(c.size, 2);
});

test("get marks as recently used", () => {
  const c = new LRUCache(2);
  c.put("a", 1);
  c.put("b", 2);
  assert.equal(c.get("a"), 1); // "a" now most recent
  c.put("c", 3); // should evict "b", not "a"
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
});

test("put updates value and recency", () => {
  const c = new LRUCache(2);
  c.put("a", 1);
  c.put("b", 2);
  c.put("a", 10); // update + most recent
  c.put("c", 3); // evicts "b"
  assert.equal(c.get("a"), 10);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("c"), 3);
});

test("numeric keys and capacity 1", () => {
  const c = new LRUCache(1);
  c.put(1, "one");
  assert.equal(c.get(1), "one");
  c.put(2, "two");
  assert.equal(c.get(1), undefined);
  assert.equal(c.get(2), "two");
  assert.equal(c.size, 1);
});
