# Aurora 🌌

> A client-side, interactive generative art gallery powered by modern web technologies, WebGPU compute shaders, and TSL.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](#tech-stack)
[![Three.js](https://img.shields.io/badge/Three.js-r171%2B%20WebGPU-black?logo=threedotjs)](#tech-stack)
[![Vite](https://img.shields.io/badge/Vite-Build%20Tool-646CFF?logo=vite&logoColor=white)](#tech-stack)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](#deployment)

---

## Overview

**Aurora** is a static, zero-backend generative art gallery. Each exhibit is an interactive "room" rendering complex procedural systems, agent simulations, or chaos mathematics in full-screen real time with live tweakable parameters.

- **Zero Backend**: Fully static single-page application — no servers, databases, or API secrets required.
- **WebGPU Compute**: Pushes particle simulations from the CPU ceiling of ~50K particles up to 500K–1M+ particles.
- **Cross-Platform Shaders**: Three Shading Language (TSL) compiles shaders to WGSL (WebGPU) with automatic WebGL2 fallback.
- **Shareable Parameter States**: Seeds and control parameters encode into the URL hash for instant sharing.
- **Built-in Recording & Export**: Export high-resolution stills or loop recordings directly from any room using `MediaRecorder` and `canvas.captureStream()`.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Vite + TypeScript** | High-performance vanilla build environment (no frontend framework overhead). |
| **Three.js r171+ (`three/webgpu`)** | Modern WebGPU rendering with automatic WebGL2 fallback. |
| **TSL (Three Shading Language)** | Unified shader authoring targeting WGSL and GLSL seamlessly. |
| **WebGPU Compute Shaders** | Large-scale particle simulations (Physarum, Particle Life, Galaxy, Fluid). |
| **Canvas2D** | Lightweight, direct canvas rendering for appropriate low-overhead systems. |
| **Tweakpane** | Compact, extensible floating parameter controls for each room. |
| **Web Audio API** | Real-time audio analysis (`AnalyserNode`) for reactive exhibits. |

---

## Architecture & Project Structure

```
/
├── src/
│   ├── rooms/                   # Individual generative art rooms
│   │   ├── flow-field/          # Perlin / curl noise particle trails
│   │   ├── domain-warp/         # Iterative domain warped fbm fragment shader
│   │   ├── boids/               # Flocking simulation with predator/mouse interaction
│   │   ├── physarum/            # Slime mold trail deposition & diffusion
│   │   ├── particle-life/       # Multi-species attraction/repulsion matrix
│   │   ├── reaction-diffusion/  # Gray-Scott reaction-diffusion system
│   │   ├── lenia/               # Continuous cellular automata
│   │   ├── differential-growth/ # Node-splitting curve growth
│   │   ├── cyclic-automata/     # Color-cycling cellular automata
│   │   ├── strange-attractors/  # Lorenz, Clifford, de Jong attractor points
│   │   ├── fractal/             # Raymarched Mandelbulb / Menger sponge
│   │   ├── wave-function-collapse/ # Procedural constraint-propagation tiling
│   │   ├── fluid/               # Navier-Stokes / SPH fluid dynamics
│   │   ├── metaballs/           # GPU marching cubes density field
│   │   ├── galaxy/              # Massive starfield & nebula fly-through
│   │   └── kaleidoscope/        # Audio-reactive radial symmetry shader
│   ├── lib/
│   │   ├── state.ts             # URL hash <-> parameter serialization & state sharing
│   │   ├── recorder.ts          # Canvas video recording & snapshot export
│   │   └── router.ts            # Hash-based gallery router
│   ├── gallery.ts               # Landing page gallery grid & preview instances
│   └── main.ts                  # Application entry point & mounting shell
├── index.html                   # Gallery shell markup
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE
└── README.md
```

### Room Interface

Every room adheres to a standard interface, allowing the gallery shell to mount, unmount, and control parameters uniformly:

```typescript
export interface ControlDef {
  name: string;
  key: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Record<string, number | string>;
}

export interface Room {
  id: string;
  name: string;
  defaultParams: Record<string, number>;
  controls: ControlDef[];
  mount(canvas: HTMLCanvasElement, params: Record<string, number>): () => void; // Returns cleanup function
}
```

---

## Room Roster

### 🌊 Field & Flow
- **Flow Field**: Perlin/curl noise vector fields guiding thousands of dynamic particle trails.
- **Domain-Warped Noise**: Layered fractional Brownian motion (fBm) with iterative coordinate distortion for marble/liquid textures.
- **Boids**: Autonomous flocking agents (separation, alignment, cohesion) interacting with interactive predator fields.

### 🧬 Artificial Life
- **Physarum**: Agent-based slime mold trail deposition and chemoattractant diffusion (Sage Jenson model) accelerated via compute shaders.
- **Particle Life**: Multi-species emergent cellular behavior driven by an attraction/repulsion matrix.
- **Reaction-Diffusion**: Gray-Scott chemical reaction modeling with ping-pong framebuffers for Turing patterns.
- **Lenia**: Continuous, multi-channel neural cellular automata with fast convolution kernels.
- **Differential Growth**: Iterative node-splitting curve expansion yielding organic corals and ruffled membranes.
- **Cyclic Cellular Automata**: Multi-state cycling cellular automata producing rotating spirals and wave fronts.

### 🌀 Chaos & Procedural
- **Strange Attractors**: Millions of phase-space points calculated from Lorenz, de Jong, Clifford, and Halvorsen dynamical systems with 3D orbital navigation.
- **Fractals**: Real-time raymarched Mandelbulb and Menger Sponge fractals with orbit camera controls.
- **Wave Function Collapse**: Procedural constraint-propagation pattern generation.

### 💧 Fluid & Surface
- **Fluid Simulation**: Real-time Navier-Stokes / SPH fluid dynamics reacting to cursor forces.
- **Metaballs**: GPU marching cubes over dynamic scalar density fields with reflective surfaces.

### 🌌 Cosmic Scale
- **Galaxy Fly-Through**: Deep-space nebula and particle starfield rendering 500K–1M+ particles via TSL storage buffers.

### 🎵 Audio-Reactive
- **Kaleidoscope**: Web Audio API `AnalyserNode` frequency extraction driving radial-symmetry shader transformations.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A modern browser with WebGPU or WebGL2 support (Chrome, Edge, Firefox, or Safari)

### Installation

```bash
# Clone the repository
git clone https://github.com/WantedChip/aurora.git
cd aurora

# Install dependencies
npm install
```

### Development Server

Start the local Vite development server:

```bash
npm run dev
```

Visit `http://localhost:5173` to explore the gallery.

### Production Build

Create an optimized static build:

```bash
npm run build
```

The output bundle will be generated in the `dist/` directory. You can preview it locally using:

```bash
npm run preview
```

---

## Landing Page & Gallery Experience

Aurora delivers an immersive exhibition interface written in 100% vanilla TypeScript, HTML5, and CSS:

### 🌟 Ambient Hero Experience
- **Interactive Ambient Background**: A full-width background canvas renders a fluid/particle field that smoothly reacts to cursor coordinates.
- **Instant Discovery**: "Explore Exhibits" smooth-scrolls directly to the grid, while "🎲 Random Room" jumps straight into a randomly seeded piece.

### 🔍 Filter & Search Toolbar
- **Category Filter Pills**: Quickly narrow exhibits by domain: `Field & Flow`, `Artificial Life`, `Chaos & Procedural`, `Fluid & Surface`, `Cosmic Scale`, or `Audio-Reactive`.
- **Instant Fuzzy Search**: Search in real time by room title, authoring technique, mathematical model, or graphics backend (`WebGPU`, `TSL`, `Canvas2D`).
- **Layout Switching**: Toggle between an interactive 1-to-4 column responsive card grid and a compact list view.

### 🖼️ Live Miniature Simulation Previews
- **Micro-Sim Canvas**: Each card embeds a lightweight `<canvas>` instance running the actual simulation logic.
- **Resource Management (`IntersectionObserver`)**:
  - Thumbnail render loops only execute when scrolled into the active viewport.
  - Preview frame rates are capped at 30 FPS at reduced resolution (320x200) to keep cumulative CPU/GPU overhead negligible across all cards.
  - Hovering on any card activates enhanced particle activity and visual depth.

### 🧭 Navigation & Room Lifecycle
- **Hash-Based Router (`router.ts`)**: Seamless transition between `/#/` (Landing Gallery) and `/#/room-id?params...` (Active Exhibit) without page reloads or server routing.
- **In-Room Toolbar**: Fullscreen toggle, snapshot capture, 5-10s WebM loop recording, randomized seeding, and instant link copying with state serialization.
- **Floating Controls**: Collapsible Tweakpane interface providing categorized, real-time parameter tweaking.

---

## UX & Features

- **Interactive Gallery Grid**: Explore rooms with interactive cards and live simulation previews.
- **Deep Linking & Sharing**: Every parameter tweak updates the URL hash (e.g., `/#/physarum?seed=42&sensorAngle=0.45&decay=0.98`), making any visual state instantly shareable.
- **Export Tools**:
  - **Snapshot**: Capture high-resolution PNG stills.
  - **Loop Recording**: Record short WebM/MP4 video loops using native canvas stream recording.
- **Performance Adaptability**: Heavy compute rooms provide desktop-optimized modes and fallback indicators for low-power devices.

---

## Deployment

Deploy directly to **Cloudflare Pages** with zero configuration:

### Method 1: Git Integration (Recommended)
1. Push your repository to GitHub / GitLab.
2. In the Cloudflare dashboard, navigate to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Deploy. Every push to `main` deploys automatically, with preview deployments for pull requests.

### Method 2: Cloudflare Wrangler CLI
```bash
# Build the application
npm run build

# Deploy directly to Cloudflare Pages
npx wrangler pages deploy dist
```

---

## Prior Art & Acknowledgments

- [morphogen](https://github.com/Artem1bar/morphogen) by Artem1bar — Generative and artificial life systems studio.
- [morphogenesis-resources](https://github.com/jasonwebb/morphogenesis-resources) by Jason Webb — Digital morphogenesis techniques and algorithm references.
- [jeantimex/fluid](https://github.com/jeantimex/fluid) — WebGPU fluid simulation using SPH/FLIP and marching cubes.
- [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) — WebGL fluid simulation reference.
- [sjpt/metaballsWebgl](https://github.com/sjpt/metaballsWebgl) — GPU marching cubes reference in Three.js.

---

## License

This project is licensed under the [MIT License](LICENSE) — see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 WantedChip
