# Gambit ♟️

**Chess. But with a coach that thinks like a founder.**

## What is this?

I play chess. Have for years. And the one thing that always bothered me about every chess platform out there — they show you that you made a mistake, but they don't really explain *why it mattered*. You get a score. You get an arrow. You move on and make the same mistake next game.

Gambit is different. After every game, an AI Coach breaks down your key moments — not in chess notation, but in plain strategy language. The kind of thinking that applies beyond the board.

## Features

- **Play vs Stockfish** — three difficulty levels (Easy / Medium / Hard), all responding in under 2 seconds
- **Time controls** — Bullet (1, 2 min), Blitz (3, 5 min), Rapid (10, 15 min), Classical (30 min). Timer starts on your first move, not before
- **AI Coach** — post-game analysis powered by Claude API. Highlights 5–7 critical moments with explanations that connect chess decisions to real strategic thinking
- **Board themes** — Classic, Walnut, Ice. Because aesthetics matter
- **Move history** — live panel next to the board, just like you'd expect
- **Mobile responsive** — works on any screen

## The idea behind AI Coach

Chess is strategy compressed into 64 squares. Every blunder has a reason — overextension, ignoring defense, chasing short-term gain over long-term position. These patterns show up everywhere.

So instead of just saying "this was a mistake", Gambit's AI Coach tells you *what kind* of mistake it was. That's the part I'm most proud of.

## Stack

- React
- Stockfish.js (UCI protocol, lightweight build)
- Claude API (Anthropic)
- Lovable (for building and deployment)

## Why I built this

This project was built as part of the nFactorial Incubator 2026 selection. The task was to make a chess platform. I tried to make something I'd actually want to use.

---

*Built in under 48 hours. Solo.*
