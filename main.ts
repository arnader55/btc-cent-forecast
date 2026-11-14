// btc-cent-forecast-01 — forecast BTC's US-dollar price 240 minutes after
// a checkpoint, from the 4,320 one-minute closes of the 72 hours up to it.
//
// Strategy: a small mean-reversion pull. The last print is trusted most of
// the way; the guess only leans one fifth of the way back toward the
// trailing 6-hour mean, because at a 4-hour horizon BTC's move is mostly
// noise and a big adjustment loses more often than it wins.
//
//   guess = last + 0.2 * (mean of last 360 closes - last)
//   adjustment capped at +/-1% of last, rounded to the 5-decimal grid.
//
// Node 22, standard library only. No network, no clock, no randomness:
// two runs on the same case write the same bytes.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const PULL = 0.2; // fraction of the gap to the trailing mean to close
const WINDOW = 360; // minutes of trailing mean (6 hours)
const CAP_FRACTION = 0.01; // max adjustment, as a fraction of the last print
const GRID = 1e5; // prices live on a 5-decimal grid

function forecast(prices: number[]): number {
  if (!Array.isArray(prices) || prices.length === 0) {
    throw new Error("case holds no prices");
  }
  const last = prices[prices.length - 1];
  if (typeof last !== "number" || !Number.isFinite(last) || last <= 0) {
    throw new Error("last close is not a positive finite number");
  }
  // Only finite closes count toward the level; a bad sample must not drag it.
  const window = prices.slice(-WINDOW).filter((p) => Number.isFinite(p));
  if (window.length === 0) {
    throw new Error("no finite closes in the trailing window");
  }
  let sum = 0;
  for (const p of window) sum += p;
  const mean = sum / window.length;

  const pull = PULL * (mean - last);
  const cap = CAP_FRACTION * last;
  const adjustment = Math.max(-cap, Math.min(cap, pull));

  const raw = last + adjustment;
  const rounded = Math.round(raw * GRID) / GRID;
  // The rules require a finite price in (0, 10_000_000).
  return Math.min(9_999_999.99999, Math.max(0.00001, rounded));
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".in"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(join(INPUT_DIR, file), "utf8");
    const kase = JSON.parse(raw);
    const id = typeof kase.case === "string" ? kase.case : file.replace(/\.in$/, "");
    const prices: number[] = kase.markets[0].prices;
    const price = forecast(prices);
    const out = JSON.stringify({ forecasts: [{ case: id, price }] });
    writeFileSync(join(OUTPUT_DIR, `${id}.out`), out + "\n", "utf8");
  }
}

main();
