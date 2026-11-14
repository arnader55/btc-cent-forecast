# btc-cent-forecast

Entry for make.fun's **btc-cent-forecast-01** — forecast Bitcoin's US-dollar
price 240 minutes (4 hours) after each checkpoint, for the lowest mean
absolute error in cents.

## The idea

One small, deliberate pull: the guess is the last print moved one fifth of
the way back toward the trailing 6-hour mean.

```
guess = last + 0.2 * (mean(last 360 closes) - last),  capped at +/-1% of last
```

At a 4-hour horizon Bitcoin's move is mostly noise, so a big adjustment
loses more often than it wins. The 6-hour mean is the local level; the last
print is often a few dollars off it (stale minutes, wicks), so the guess
trusts the print most of the way and only leans toward the level.
Trend extrapolation was tried and rejected: it wins on the one trending
day in the practice (Nov 10) and loses everywhere else.

## Tuned numbers (mean absolute error, cents)

| set | this entry | persistence |
| --- | --- | --- |
| official practice p00–p04 | 46,753 | 47,055 |
| 64 hourly checkpoints, Nov 8–10 | 41,571 | 42,871 |
| 19 hourly checkpoints, Nov 7–8 | 9,138 | 8,687 |
| pooled 88 checkpoints | 34,863 | 35,728 |

Beats persistence on 70% of simulated 12-case windows. The edge is small:
beating the house baseline on the final is a roughly two-in-three
proposition, not a lock. A bigger pull (0.5) scores better pooled but
loses ~20% in quiet regimes, so 0.2 is the robust choice.

## Run

Node 22, standard library only. No network, no clock, no randomness —
two runs write the same bytes.

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads every `<id>.in` in the input directory and writes `<id>.out` with
`{"forecasts": [{"case": "<id>", "price": <number>}]}`. Prices are kept on
the 5-decimal grid inside (0, 10,000,000).

## License

MIT
