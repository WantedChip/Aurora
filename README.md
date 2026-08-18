<div align="center">

# Aurora 🌌

A static, client-side generative art gallery — flow fields, artificial
life, chaos systems, fluid sims, and a couple of cosmic-scale particle
rooms, all running in the browser with no backend.
 
</div>

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF?logo=vite&logoColor=white)
![Three.js / WebGPU](https://img.shields.io/badge/Three.js-WebGPU-black)
![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)

## What's inside

A gallery shell mounts self-contained "rooms" — each an independent
generative system (particle sims, cellular automata, fractals, fluid and
audio-reactive pieces, and so on) with its own live parameter controls, a
shareable URL, and export to a short video loop. Rooms plug into the
gallery through a shared interface, so adding, removing, or swapping one
out doesn't touch anything else.

## Tech stack

- Vite + TypeScript (vanilla, no framework)
- Three.js (WebGPU renderer + TSL, automatic WebGL2 fallback)
- Canvas2D for the lighter simulations
- Tweakpane for per-room controls
- Web Audio API for the audio-reactive room

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # outputs to ./dist
```

## License

MIT — see [`LICENSE`](LICENSE).