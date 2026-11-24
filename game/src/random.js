// Seeded randomness: mulberry32 plus the few helpers the city and the crowd need.
// The same seed always builds the same city and the same traffic, which is what makes the
// screenshot poses and the demos reproducible.

export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}
