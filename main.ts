// btc-cent-forecast-01 entry (Node 22, standard library only).
//
// A point forecaster for Bitcoin's US-dollar price 240 minutes (4 hours)
// after each checkpoint. One idea, tuned on the six public practice cases
// and on 83 extra hourly checkpoints cut from the same recording (Nov 7-10,
// 2026), and kept small on purpose: at this horizon Bitcoin's 4-hour move
// is mostly noise, so a big adjustment loses more often than it wins.
//
//   guess = last + 0.2 * (mean of the last 360 closes - last),
//   with the adjustment capped at +/-1% of the last price.
//
// The 6-hour trailing mean is the local level; the last print is often a
// few dollars off it (stale minutes, wicks), so the guess is pulled one
// fifth of the way back toward the level instead of trusting the print
// outright. Trend extrapolation was tried and rejected: it wins on the
// one trending day in the practice (Nov 10) and loses everywhere else.
//
// Tuned numbers (mean absolute error in cents, lower better):
//   - official practice p00-p04: 46,753 vs persistence 47,055 (-0.6%),
//     re-verified in the submission session (Nov 15, 2026) from the
//     actual .out files against the next case's checkpoint close.
//   - 64 hourly checkpoints Nov 8-10: 41,571 vs persistence 42,871 (-3.0%)
//   - 19 hourly checkpoints Nov 7-8: 9,138 vs persistence 8,687 (+5.2%)
//   - pooled 88 checkpoints: 34,863 vs persistence 35,728 (-2.4%)
//   - beats persistence on 70% of simulated 12-case windows (hourly
//     starts) and 80% (4-hour starts). The edge is small: beating the
//     house baseline on the final is a roughly two-in-three proposition,
//     not a lock. A bigger pull (lambda 0.5) scores better pooled but
//     loses ~20% in quiet regimes, so 0.2 is the robust choice.
//
// Everything is a pure function of the case file: no randomness, no
// network, no clock, so two runs write the same bytes. Reads every
// <id>.in in the input directory and writes <id>.out for each, like the
// kit's starter:
//
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Trailing window for the local level, in minutes of closes. */
const REV_WINDOW_MIN = 360;
/** How far the guess is pulled from the last print toward the level. */
const REV_LAMBDA = 0.2;
/** The adjustment is capped at this fraction of the last price. */
const CAP_FRAC = 0.01;

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** Mean of a list of numbers (0 for an empty list). */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** The forecast of one market: last print pulled toward the 6-hour mean. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const x = m.prices[m.prices.length - 1] as number;
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  const level = mean(m.prices.slice(-REV_WINDOW_MIN));
  const capped = x + Math.min(CAP_FRAC * x, Math.max(-CAP_FRAC * x, REV_LAMBDA * (level - x)));
  return price5(capped);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
