/**
 * Aurora Central Room Catalog & Dynamic Module Registry
 * 
 * Defines metadata, curatorial notes, mathematical models, parameter schemas,
 * and dynamic lazy-loading resolvers for all 16 generative exhibits.
 */

import type { RoomMetadata, RoomInstance, RoomCategory } from './types';
import { createMockRoom } from './mock-room';

export const ROOM_CATALOG: readonly RoomMetadata[] = [
  // Room 01
  {
    id: 'flow-field',
    index: 1,
    indexDisplay: '#01',
    name: 'Flow Field',
    category: 'field-flow',
    categoryName: 'Field & Flow',
    backend: 'canvas2d',
    backendDisplay: 'CANVAS 2D',
    mathModel: 'Perlin & Curl Vector Noise Trails',
    description: 'Dynamic vector particle trails driven by multi-scale Perlin and curl noise potential fields.',
    curatorialNote: 'Explores the visual behavior of particulate advection across smooth, continuous divergence-free velocity fields.',
    tags: ['noise', 'curl', 'perlin', 'vector-field', 'particles', 'trails', 'advection'],
    moods: ['organic', 'meditative', 'hypnotic', 'flowing'],
    defaultParams: {
      seed: '#A8F29D',
      particleCount: 5000,
      speed: 1.0,
      noiseScale: 0.003,
      curlStrength: 1.5,
      octaves: 3,
      stepLength: 2.0,
      trailDecay: 0.03,
      colorPalette: 'aurora-cyan',
    },
    controls: [
      { key: 'particleCount', label: 'Particle Count', type: 'slider', min: 1000, max: 25000, step: 500, folder: 'Simulation' },
      { key: 'speed', label: 'Speed Multiplier', type: 'slider', min: 0.2, max: 4.0, step: 0.1, folder: 'Simulation' },
      { key: 'noiseScale', label: 'Noise Frequency', type: 'slider', min: 0.0005, max: 0.008, step: 0.0005, folder: 'Field Dynamics' },
      { key: 'curlStrength', label: 'Curl Turbulence', type: 'slider', min: 0.2, max: 4.0, step: 0.1, folder: 'Field Dynamics' },
      { key: 'octaves', label: 'Noise Octaves', type: 'slider', min: 1, max: 5, step: 1, folder: 'Field Dynamics' },
      { key: 'stepLength', label: 'Step Length', type: 'slider', min: 0.5, max: 5.0, step: 0.1, folder: 'Field Dynamics' },
      { key: 'trailDecay', label: 'Trail Fade Rate', type: 'slider', min: 0.005, max: 0.15, step: 0.005, folder: 'Aesthetics' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Aurora Cyan', value: 'aurora-cyan' },
          { label: 'Solar Amber', value: 'solar-amber' },
          { label: 'Phosphor Mint', value: 'phosphor-mint' },
          { label: 'Spectral Violet', value: 'spectral-violet' },
          { label: 'Laser Crimson', value: 'laser-crimson' },
          { label: 'Obsidian Mono', value: 'obsidian-mono' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 02
  {
    id: 'domain-warp',
    index: 2,
    indexDisplay: '#02',
    name: 'Domain-Warped Noise',
    category: 'field-flow',
    categoryName: 'Field & Flow',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Iterative fBm Coordinate Displacement',
    description: 'Multi-layered fractional Brownian motion with recursive coordinate domain displacement.',
    curatorialNote: 'Renders organic, marbled liquid textures through nested evaluation of higher-order gradient noise matrices.',
    tags: ['fbm', 'shader', 'domain-warp', 'marble', 'procedural', 'tsl', 'distortion'],
    moods: ['hypnotic', 'organic', 'psychedelic', 'meditative'],
    defaultParams: {
      seed: '#E24991',
      warpIntensity: 1.8,
      frequency: 2.2,
      colorSpread: 1.4,
      animSpeed: 0.25,
      distortionAngle: 0.8,
      mouseInfluence: 1.2,
      colorPalette: 'aurora-teal',
    },
    controls: [
      { key: 'warpIntensity', label: 'Warp Depth', type: 'slider', min: 0.0, max: 4.0, step: 0.1, folder: 'Warp Engine' },
      { key: 'frequency', label: 'Base Frequency', type: 'slider', min: 0.5, max: 6.0, step: 0.1, folder: 'Warp Engine' },
      { key: 'distortionAngle', label: 'Distortion Angle', type: 'slider', min: 0.0, max: 6.28, step: 0.1, folder: 'Warp Engine' },
      { key: 'animSpeed', label: 'Evolution Speed', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Simulation' },
      { key: 'mouseInfluence', label: 'Cursor Warp', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Simulation' },
      { key: 'colorSpread', label: 'Chromatic Spread', type: 'slider', min: 0.5, max: 3.0, step: 0.1, folder: 'Color Tone' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Aurora Teal', value: 'aurora-teal' },
          { label: 'Solar Magma', value: 'solar-magma' },
          { label: 'Spectral Abyss', value: 'spectral-abyss' },
          { label: 'Obsidian Marble', value: 'obsidian-marble' },
          { label: 'Iridescent Pearl', value: 'iridescent-pearl' },
        ],
        folder: 'Color Tone',
      },
    ],
  },

  // Room 03
  {
    id: 'boids',
    index: 3,
    indexDisplay: '#03',
    name: 'Boids Flocking Simulation',
    category: 'field-flow',
    categoryName: 'Field & Flow',
    backend: 'canvas2d',
    backendDisplay: 'CANVAS 2D',
    mathModel: "Craig Reynolds' Steering Behaviors",
    description: 'Autonomous flocking agents governed by separation, alignment, and cohesion steering forces.',
    curatorialNote: 'Demonstrates emergent macro-structural flock dynamics arising strictly from local peer interactions.',
    tags: ['boids', 'flocking', 'steering', 'agents', 'predator', 'swarm', 'emergent'],
    moods: ['organic', 'emergent', 'energetic', 'alive'],
    defaultParams: {
      seed: '#39A2FF',
      boidCount: 2000,
      maxSpeed: 4.5,
      separationWeight: 1.8,
      alignmentWeight: 1.2,
      cohesionWeight: 1.0,
      neighborRadius: 65,
      predatorRepulsion: 4.5,
      trailDecay: 0.18,
      colorPalette: 'aurora-cyan',
    },
    controls: [
      { key: 'boidCount', label: 'Flock Size', type: 'slider', min: 200, max: 5000, step: 100, folder: 'Flock' },
      { key: 'maxSpeed', label: 'Max Speed', type: 'slider', min: 1.0, max: 10.0, step: 0.5, folder: 'Flock' },
      { key: 'separationWeight', label: 'Separation', type: 'slider', min: 0.1, max: 5.0, step: 0.1, folder: 'Steering Weights' },
      { key: 'alignmentWeight', label: 'Alignment', type: 'slider', min: 0.1, max: 5.0, step: 0.1, folder: 'Steering Weights' },
      { key: 'cohesionWeight', label: 'Cohesion', type: 'slider', min: 0.1, max: 5.0, step: 0.1, folder: 'Steering Weights' },
      { key: 'neighborRadius', label: 'Neighbor Radius', type: 'slider', min: 20, max: 150, step: 5, folder: 'Steering Weights' },
      { key: 'predatorRepulsion', label: 'Cursor Fear', type: 'slider', min: 0.0, max: 10.0, step: 0.5, folder: 'Interaction' },
      { key: 'trailDecay', label: 'Trail Persistence', type: 'slider', min: 0.02, max: 0.5, step: 0.02, folder: 'Aesthetics' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Aurora Cyan', value: 'aurora-cyan' },
          { label: 'Solar Amber', value: 'solar-amber' },
          { label: 'Spectral Violet', value: 'spectral-violet' },
          { label: 'Phosphor Mint', value: 'phosphor-mint' },
          { label: 'Obsidian Mono', value: 'obsidian-mono' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 04
  {
    id: 'physarum',
    index: 4,
    indexDisplay: '#04',
    name: 'Physarum Slime Mold',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'webgpu-compute',
    backendDisplay: 'WEBGPU COMPUTE',
    mathModel: 'Sage Jenson Chemoattractant Deposition',
    description: 'Biological slime mold simulation utilizing 500K+ compute agents, sensory steering, and chemical diffusion.',
    curatorialNote: 'Replicates biological network optimization, vascular morphogenesis, and nutrient search behaviors of Physarum polycephalum.',
    tags: ['slime-mold', 'physarum', 'compute', 'agents', 'chemoattractant', 'diffusion', 'biomimetic'],
    moods: ['organic', 'biomimetic', 'hypnotic', 'complex'],
    defaultParams: {
      seed: '#00FF9D',
      agentCount: 500000,
      sensorAngle: 0.45,
      sensorDistance: 16.0,
      stepSize: 1.2,
      decayRate: 0.96,
      diffuseRate: 0.9,
      depositAmount: 5.0,
      colorPalette: 'phosphor-green',
    },
    controls: [
      { key: 'agentCount', label: 'Agent Count', type: 'slider', min: 10000, max: 1000000, step: 10000, folder: 'Agents' },
      { key: 'stepSize', label: 'Motor Step Size', type: 'slider', min: 0.4, max: 3.0, step: 0.1, folder: 'Agents' },
      { key: 'sensorAngle', label: 'Sensor Angle', type: 'slider', min: 0.1, max: 1.2, step: 0.05, folder: 'Sensory Steering' },
      { key: 'sensorDistance', label: 'Sensor Range', type: 'slider', min: 4.0, max: 40.0, step: 1.0, folder: 'Sensory Steering' },
      { key: 'decayRate', label: 'Trail Decay', type: 'slider', min: 0.85, max: 0.99, step: 0.005, folder: 'Chemical Field' },
      { key: 'diffuseRate', label: 'Diffusion Rate', type: 'slider', min: 0.1, max: 1.0, step: 0.05, folder: 'Chemical Field' },
      { key: 'depositAmount', label: 'Deposit Strength', type: 'slider', min: 1.0, max: 15.0, step: 0.5, folder: 'Chemical Field' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Phosphor Green', value: 'phosphor-green' },
          { label: 'Obsidian Violet', value: 'obsidian-violet' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Solar Amber', value: 'solar-amber' },
          { label: 'Spectral Crimson', value: 'spectral-crimson' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 05
  {
    id: 'particle-life',
    index: 5,
    indexDisplay: '#05',
    name: 'Particle Life',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'webgpu-compute',
    backendDisplay: 'WEBGPU COMPUTE',
    mathModel: 'Multi-Species Attraction Matrix',
    description: '100,000+ particles across multiple color species interacting via asymmetric attraction and repulsion forces.',
    curatorialNote: 'Spontaneously gives rise to cellular clustering, orbital symbiosis, and predatory chase mechanics without pre-programmed intelligence.',
    tags: ['particles', 'attraction', 'matrix', 'multi-species', 'cellular', 'artificial-life', 'physics'],
    moods: ['emergent', 'complex', 'alive', 'organic'],
    defaultParams: {
      seed: '#FFB800',
      preset: 'symbiosis',
      particleCount: 50000,
      speciesCount: 6,
      interactionRadius: 80.0,
      friction: 0.05,
      forceMultiplier: 1.0,
      repulsionZone: 0.3,
      trailDecay: 0.15,
      colorPalette: 'spectral-aurora',
    },
    controls: [
      {
        key: 'preset',
        label: 'Rule Preset',
        type: 'select',
        options: [
          { label: 'Symbiosis (Membranes)', value: 'symbiosis' },
          { label: 'Predators (Chase Loops)', value: 'predators' },
          { label: 'Mitosis (Cell Division)', value: 'mitosis' },
          { label: 'Swarm (Schooling)', value: 'swarm' },
          { label: 'Chaos (Turbulence)', value: 'chaos' },
          { label: 'Random Matrix', value: 'random' },
        ],
        folder: 'Universe',
      },
      { key: 'particleCount', label: 'Particle Count', type: 'slider', min: 2000, max: 100000, step: 2000, folder: 'Universe' },
      { key: 'speciesCount', label: 'Species Count (K)', type: 'slider', min: 3, max: 8, step: 1, folder: 'Universe' },
      { key: 'interactionRadius', label: 'Force Radius (R)', type: 'slider', min: 30.0, max: 180.0, step: 5.0, folder: 'Physics' },
      { key: 'forceMultiplier', label: 'Force Strength', type: 'slider', min: 0.2, max: 3.0, step: 0.1, folder: 'Physics' },
      { key: 'repulsionZone', label: 'Repulsion Core (β)', type: 'slider', min: 0.1, max: 0.6, step: 0.05, folder: 'Physics' },
      { key: 'friction', label: 'Drag Friction', type: 'slider', min: 0.01, max: 0.20, step: 0.01, folder: 'Physics' },
      { key: 'trailDecay', label: 'Trail Persistence', type: 'slider', min: 0.02, max: 0.40, step: 0.02, folder: 'Aesthetics' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Cyber Neon', value: 'cyber-neon' },
          { label: 'Solar Flame', value: 'solar-flame' },
          { label: 'Deep Abyss', value: 'deep-abyss' },
          { label: 'Obsidian Mono', value: 'obsidian-mono' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 06
  {
    id: 'reaction-diffusion',
    index: 6,
    indexDisplay: '#06',
    name: 'Reaction-Diffusion',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Gray-Scott Laplacian Kinetics',
    description: 'Numerical simulation of Gray-Scott chemical reaction-diffusion equations generating organic Turing patterns.',
    curatorialNote: 'Models Turing pattern formation responsible for leopard spots, zebra stripes, and coral reef skin textures in theoretical biology.',
    tags: ['turing', 'gray-scott', 'laplacian', 'morphogenesis', 'fbo', 'chemistry', 'coral'],
    moods: ['organic', 'meditative', 'hypnotic', 'geometric'],
    defaultParams: {
      seed: '#9B51E0',
      preset: 'coral',
      feedRate: 0.0545,
      killRate: 0.062,
      diffuseU: 1.0,
      diffuseV: 0.5,
      simSpeed: 12,
      reliefScale: 2.2,
      brushRadius: 25,
      brushIntensity: 0.8,
      colorPalette: 'obsidian-coral',
    },
    controls: [
      {
        key: 'preset',
        label: 'Morphology Preset',
        type: 'select',
        options: [
          { label: 'Coral (Branched Reef)', value: 'coral' },
          { label: 'Solitons (Pulsing Waves)', value: 'solitons' },
          { label: 'Mitosis (Cell Division)', value: 'mitosis' },
          { label: 'Worms (Labyrinth Mazes)', value: 'worms' },
          { label: 'Spirals (Rotating Waves)', value: 'spirals' },
          { label: 'Chaos (Turbulence)', value: 'chaos' },
          { label: 'Spots (Leopard Dots)', value: 'spots' },
          { label: 'Holes (Inverted Matrix)', value: 'holes' },
        ],
        folder: 'Morphology',
      },
      { key: 'feedRate', label: 'Feed Rate (F)', type: 'slider', min: 0.01, max: 0.09, step: 0.001, folder: 'Gray-Scott Kinetics' },
      { key: 'killRate', label: 'Kill Rate (k)', type: 'slider', min: 0.04, max: 0.07, step: 0.001, folder: 'Gray-Scott Kinetics' },
      { key: 'diffuseU', label: 'Diffusion U (DA)', type: 'slider', min: 0.5, max: 1.5, step: 0.05, folder: 'Diffusion Rates' },
      { key: 'diffuseV', label: 'Diffusion V (DB)', type: 'slider', min: 0.1, max: 0.8, step: 0.05, folder: 'Diffusion Rates' },
      { key: 'simSpeed', label: 'Substeps / Frame', type: 'slider', min: 1, max: 24, step: 1, folder: 'Simulation Engine' },
      { key: 'reliefScale', label: '3D Relief Scale', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: '3D Relief & Shading' },
      { key: 'brushRadius', label: 'Paint Radius', type: 'slider', min: 5, max: 60, step: 1, folder: 'Interaction' },
      { key: 'brushIntensity', label: 'Paint Strength', type: 'slider', min: 0.1, max: 1.0, step: 0.05, folder: 'Interaction' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Obsidian Coral', value: 'obsidian-coral' },
          { label: 'Bioluminescent Emerald', value: 'bioluminescent-emerald' },
          { label: 'Solar Magma', value: 'solar-magma' },
          { label: 'Spectral Abyss', value: 'spectral-abyss' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 07
  {
    id: 'lenia',
    index: 7,
    indexDisplay: '#07',
    name: 'Lenia',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Continuous Neural Cellular Automata',
    description: 'Continuous spacetime cellular automata generating autonomous swimming lifeforms and morphing solitons.',
    curatorialNote: 'Generalizes Conway’s Game of Life into a continuous mathematical landscape capable of supporting self-organizing digital lifeforms.',
    tags: ['lenia', 'continuous-automata', 'soliton', 'convolution', 'neural', 'lifeforms'],
    moods: ['alive', 'alien', 'meditative', 'hypnotic'],
    defaultParams: {
      seed: '#00E5FF',
      preset: 'orbium',
      mu: 0.156,
      sigma: 0.0224,
      dt: 0.10,
      kernelRadius: 13,
      simSpeed: 1,
      brushRadius: 16,
      brushIntensity: 0.85,
      reliefScale: 2.0,
      colorPalette: 'bioluminescent-cyan',
    },
    controls: [
      {
        key: 'preset',
        label: 'Species Preset',
        type: 'select',
        options: [
          { label: 'Orbium (Solitary Glider)', value: 'orbium' },
          { label: 'Gyrobium (Spinning Rotor)', value: 'gyrobium' },
          { label: 'Tessellatium (Crystalline Lattice)', value: 'tessellatium' },
          { label: 'Scutium (Armored Shield)', value: 'scutium' },
          { label: 'Pentapetalum (Pulsating Blossom)', value: 'pentapetalum' },
        ],
        folder: 'Species Preset',
      },
      { key: 'mu', label: 'Growth Center (m / μ)', type: 'slider', min: 0.05, max: 0.35, step: 0.002, folder: 'Growth Mapping' },
      { key: 'sigma', label: 'Growth Width (s / σ)', type: 'slider', min: 0.005, max: 0.05, step: 0.001, folder: 'Growth Mapping' },
      { key: 'dt', label: 'Time Step (Δt)', type: 'slider', min: 0.02, max: 0.25, step: 0.01, folder: 'Spacetime & Kernel' },
      { key: 'kernelRadius', label: 'Kernel Radius (R)', type: 'slider', min: 8, max: 24, step: 1, folder: 'Spacetime & Kernel' },
      { key: 'simSpeed', label: 'Substeps / Frame', type: 'slider', min: 1, max: 4, step: 1, folder: 'Spacetime & Kernel' },
      { key: 'reliefScale', label: '3D Relief Scale', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: 'Aesthetics' },
      { key: 'brushRadius', label: 'Seed Radius', type: 'slider', min: 4, max: 40, step: 1, folder: 'Interaction' },
      { key: 'brushIntensity', label: 'Seed Density', type: 'slider', min: 0.1, max: 1.0, step: 0.05, folder: 'Interaction' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Spectral Amethyst', value: 'spectral-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Aesthetics',
      },
    ],
  },

  // Room 08
  {
    id: 'differential-growth',
    index: 8,
    indexDisplay: '#08',
    name: 'Differential Growth',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'canvas2d',
    backendDisplay: 'CANVAS 2D',
    mathModel: 'Node-Splitting Organic Curve Expansion',
    description: 'Planar curve growth through iterative node subdivision, spring relaxation, and spatial repulsion.',
    curatorialNote: 'Emulates the undulating margins of petals, intestinal villi, brain cortex folding, and fungal hyphae.',
    tags: ['differential-growth', 'curve', 'meandering', 'subdivision', 'relaxation', 'flora', 'morphogenesis'],
    moods: ['organic', 'geometric', 'calm', 'intricate'],
    defaultParams: {
      seed: '#FF8A00',
      preset: 'ring',
      maxNodes: 5000,
      growthRate: 14,
      splitThreshold: 14.0,
      targetEdgeLength: 8.0,
      repulsionRadius: 22.0,
      repulsionStrength: 0.9,
      springStrength: 0.5,
      simSpeed: 2,
      renderMode: 'stroke-membrane',
      strokeWidth: 2.0,
      glowIntensity: 0.75,
      membraneOpacity: 0.12,
      pointerMode: 'repel',
      pointerRadius: 110,
      pointerStrength: 1.0,
      colorPalette: 'coral-flora',
    },
    controls: [
      {
        key: 'preset',
        label: 'Morphology Seed',
        type: 'select',
        options: [
          { label: 'Coral Ring (Single Loop)', value: 'ring' },
          { label: 'Concentric Dual (Nested Rings)', value: 'double-ring' },
          { label: 'Floral Star (8-Lobe Blossom)', value: 'star' },
          { label: 'Serpentine Line (Open Curve)', value: 'line' },
          { label: 'Cell Cluster (4 Colonies)', value: 'quad-colonies' },
        ],
        folder: 'Morphology',
      },
      { key: 'maxNodes', label: 'Max Node Capacity', type: 'slider', min: 500, max: 12000, step: 250, folder: 'Growth Constraints' },
      { key: 'growthRate', label: 'Splits / Step', type: 'slider', min: 1, max: 35, step: 1, folder: 'Growth Constraints' },
      { key: 'splitThreshold', label: 'Split Distance', type: 'slider', min: 8.0, max: 28.0, step: 1.0, folder: 'Growth Constraints' },
      { key: 'targetEdgeLength', label: 'Target Rest Length', type: 'slider', min: 4.0, max: 16.0, step: 0.5, folder: 'Growth Constraints' },
      { key: 'repulsionRadius', label: 'Repulsion Radius', type: 'slider', min: 10.0, max: 40.0, step: 1.0, folder: 'Spring & Repulsion' },
      { key: 'repulsionStrength', label: 'Repulsion Force', type: 'slider', min: 0.2, max: 2.5, step: 0.05, folder: 'Spring & Repulsion' },
      { key: 'springStrength', label: 'Spring & Smoothing', type: 'slider', min: 0.1, max: 1.0, step: 0.05, folder: 'Spring & Repulsion' },
      { key: 'simSpeed', label: 'Substeps / Frame', type: 'slider', min: 1, max: 5, step: 1, folder: 'Spring & Repulsion' },
      {
        key: 'renderMode',
        label: 'Render Mode',
        type: 'select',
        options: [
          { label: 'Stroke & Membrane', value: 'stroke-membrane' },
          { label: 'Luminous Stroke Only', value: 'luminous-stroke' },
          { label: 'Membrane Fill Only', value: 'membrane-only' },
          { label: 'Nodes & Skeleton', value: 'nodes-mesh' },
        ],
        folder: 'Aesthetics & Rendering',
      },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Coral Flora', value: 'coral-flora' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Solar Amber', value: 'solar-amber' },
          { label: 'Spectral Amethyst', value: 'spectral-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Aesthetics & Rendering',
      },
      { key: 'strokeWidth', label: 'Stroke Width', type: 'slider', min: 0.8, max: 5.0, step: 0.2, folder: 'Aesthetics & Rendering' },
      { key: 'glowIntensity', label: 'Glow Intensity', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Aesthetics & Rendering' },
      { key: 'membraneOpacity', label: 'Membrane Opacity', type: 'slider', min: 0.0, max: 0.4, step: 0.02, folder: 'Aesthetics & Rendering' },
      {
        key: 'pointerMode',
        label: 'Pointer Probe Mode',
        type: 'select',
        options: [
          { label: 'Repel Nodes', value: 'repel' },
          { label: 'Attract Nodes', value: 'attract' },
          { label: 'Feed / Stimulate Growth', value: 'feed' },
        ],
        folder: 'Interaction',
      },
      { key: 'pointerRadius', label: 'Probe Radius', type: 'slider', min: 40, max: 250, step: 5, folder: 'Interaction' },
      { key: 'pointerStrength', label: 'Probe Strength', type: 'slider', min: 0.2, max: 3.0, step: 0.1, folder: 'Interaction' },
    ],
  },

  // Room 09
  {
    id: 'cyclic-automata',
    index: 9,
    indexDisplay: '#09',
    name: 'Cyclic Cellular Automata',
    category: 'art-life',
    categoryName: 'Artificial Life',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'David Griffeath Multi-State Spiral Automata',
    description: 'Discrete cellular automata where cell states cycle on threshold neighbor counts, creating self-organizing spirals.',
    curatorialNote: 'A discrete spatial voting model that reliably produces complex rotating spiral waves and chromatic crystal lattices.',
    tags: ['cellular-automata', 'cyclic', 'spirals', 'discrete', 'tiling', 'griffeath'],
    moods: ['geometric', 'hypnotic', 'mesmerizing', 'retro'],
    defaultParams: {
      seed: '#FF0055',
      preset: 'spiral-crystals',
      stateCount: 14,
      threshold: 3,
      neighborhoodRange: 2,
      neighborhoodType: 'moore',
      simSpeed: 3,
      reliefScale: 1.8,
      brushRadius: 20,
      brushMode: 'disrupt',
      colorPalette: 'spectral-aurora',
    },
    controls: [
      {
        key: 'preset',
        label: 'Rule Preset',
        type: 'select',
        options: [
          { label: 'Spiral Crystals (14-State Moore)', value: 'spiral-crystals' },
          { label: 'Amoeba Waves (8-State Rapid)', value: 'amoeba-waves' },
          { label: 'Turbulence (16-State R3)', value: 'turbulence' },
          { label: 'Perfect Spirals (16-State Classic)', value: 'perfect-spirals' },
          { label: '31-State Chaos (Dense Lattice)', value: 'chaos-31' },
          { label: 'Lava Plumes (12-State Viscous)', value: 'lava' },
        ],
        folder: 'Universe & Rules',
      },
      { key: 'stateCount', label: 'Color States (N)', type: 'slider', min: 4, max: 32, step: 1, folder: 'Universe & Rules' },
      { key: 'threshold', label: 'Advance Threshold (K)', type: 'slider', min: 1, max: 8, step: 1, folder: 'Universe & Rules' },
      { key: 'neighborhoodRange', label: 'Neighborhood Range (R)', type: 'slider', min: 1, max: 4, step: 1, folder: 'Universe & Rules' },
      {
        key: 'neighborhoodType',
        label: 'Neighborhood Type',
        type: 'select',
        options: [
          { label: 'Moore (Square Box)', value: 'moore' },
          { label: 'Von Neumann (Diamond)', value: 'von-neumann' },
        ],
        folder: 'Universe & Rules',
      },
      { key: 'simSpeed', label: 'Substeps / Frame', type: 'slider', min: 1, max: 10, step: 1, folder: 'Simulation' },
      { key: 'reliefScale', label: '3D Relief Scale', type: 'slider', min: 0.0, max: 4.0, step: 0.1, folder: 'Aesthetics' },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Flare', value: 'solar-flare' },
          { label: 'Cyber Neon', value: 'cyber-neon' },
          { label: 'Bioluminescent Emerald', value: 'bioluminescent-emerald' },
          { label: 'Obsidian Amethyst', value: 'obsidian-amethyst' },
          { label: 'Monochrome Matrix', value: 'monochrome-matrix' },
        ],
        folder: 'Aesthetics',
      },
      {
        key: 'brushMode',
        label: 'Pointer Mode',
        type: 'select',
        options: [
          { label: 'Disrupt (Chaotic Nucleation)', value: 'disrupt' },
          { label: 'Vortex (Archimedean Spiral)', value: 'vortex' },
          { label: 'Advance (Cycle State)', value: 'advance' },
        ],
        folder: 'Interaction',
      },
      { key: 'brushRadius', label: 'Brush Radius', type: 'slider', min: 5, max: 60, step: 1, folder: 'Interaction' },
    ],
  },

  // Room 10
  {
    id: 'strange-attractors',
    index: 10,
    indexDisplay: '#10',
    name: 'Strange Attractors',
    category: 'chaos',
    categoryName: 'Chaos & Procedural',
    backend: 'webgl2',
    backendDisplay: 'WEBGL 3D',
    mathModel: 'RK4 Numerical Integration & Discrete Maps',
    description: 'Millions of 3D trajectory points plotted from non-linear differential systems and discrete maps with luminescent velocity shading.',
    curatorialNote: 'Visualizes the sensitive dependence on initial conditions that characterizes the butterfly effect in chaotic dynamical systems (Lorenz, Aizawa, Halvorsen, Thomas, Rössler, Chen, Clifford, Peter de Jong).',
    tags: ['chaos', 'attractor', 'lorenz', 'aizawa', 'halvorsen', 'thomas', 'rossler', 'chen', 'clifford', 'dejong', 'rk4', 'point-cloud', 'fractal'],
    moods: ['cosmic', 'mathematical', 'hypnotic', 'delicate', 'ethereal'],
    defaultParams: {
      seed: '#00F0FF',
      attractorType: 'lorenz',
      pointCount: 300000,
      dt: 0.005,
      paramA: 10.0,
      paramB: 28.0,
      paramC: 2.667,
      paramD: 0.7,
      evolutionSpeed: 1.0,
      streamCount: 60,
      colorMode: 'velocity',
      colorPalette: 'spectral-aurora',
      pointSize: 1.5,
      glowIntensity: 1.0,
      cameraAutoRotate: true,
      rotationSpeed: 0.4,
      cameraFov: 50,
    },
    controls: [
      {
        key: 'attractorType',
        label: 'Attractor System',
        type: 'select',
        options: [
          { label: 'Lorenz Attractor', value: 'lorenz' },
          { label: 'Aizawa Attractor', value: 'aizawa' },
          { label: 'Halvorsen Attractor', value: 'halvorsen' },
          { label: 'Thomas Cyclical', value: 'thomas' },
          { label: 'Rössler Ribbon', value: 'rossler' },
          { label: 'Chen Dual-Scroll', value: 'chen' },
          { label: 'Clifford Map 3D', value: 'clifford' },
          { label: 'Peter de Jong 3D', value: 'dejong' },
        ],
        folder: 'Dynamical System',
      },
      { key: 'pointCount', label: 'Point Count', type: 'slider', min: 50000, max: 1000000, step: 25000, folder: 'Dynamical System' },
      { key: 'dt', label: 'Integration Step dt', type: 'slider', min: 0.001, max: 0.02, step: 0.001, folder: 'Dynamical System' },
      { key: 'evolutionSpeed', label: 'Flow Speed', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Dynamical System' },
      { key: 'streamCount', label: 'Stream Threads', type: 'slider', min: 10, max: 200, step: 5, folder: 'Dynamical System' },
      { key: 'paramA', label: 'Parameter A (σ / a)', type: 'slider', min: -5.0, max: 50.0, step: 0.1, folder: 'Parameters' },
      { key: 'paramB', label: 'Parameter B (ρ / b)', type: 'slider', min: -5.0, max: 50.0, step: 0.1, folder: 'Parameters' },
      { key: 'paramC', label: 'Parameter C (β / c)', type: 'slider', min: -5.0, max: 15.0, step: 0.01, folder: 'Parameters' },
      { key: 'paramD', label: 'Parameter D (d)', type: 'slider', min: -5.0, max: 10.0, step: 0.1, folder: 'Parameters' },
      {
        key: 'colorMode',
        label: 'Color Dimension',
        type: 'select',
        options: [
          { label: 'Velocity Magnitude', value: 'velocity' },
          { label: 'Trajectory Curvature', value: 'curvature' },
          { label: 'Z-Depth / Radius', value: 'depth' },
          { label: 'Orbit Timeline', value: 'timeline' },
        ],
        folder: 'Aesthetics',
      },
      {
        key: 'colorPalette',
        label: 'Color Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Aesthetics',
      },
      { key: 'pointSize', label: 'Point Size', type: 'slider', min: 0.5, max: 5.0, step: 0.1, folder: 'Aesthetics' },
      { key: 'glowIntensity', label: 'Luminescence', type: 'slider', min: 0.2, max: 2.0, step: 0.05, folder: 'Aesthetics' },
      { key: 'cameraAutoRotate', label: 'Auto Rotate', type: 'boolean', folder: 'Camera' },
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Camera' },
      { key: 'cameraFov', label: 'Field of View', type: 'slider', min: 30, max: 90, step: 1, folder: 'Camera' },
    ],
  },

  // Room 11
  {
    id: 'fractal',
    index: 11,
    indexDisplay: '#11',
    name: 'Raymarched Fractals',
    category: 'chaos',
    categoryName: 'Chaos & Procedural',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Distance Estimated Mandelbulb, Menger Sponge & Mandelbox',
    description: 'Real-time raymarching through 3D Mandelbulb, Menger Sponge, Mandelbox, and Quaternion Julia fractal distance estimation fields.',
    curatorialNote: 'Explores hyper-complex infinite structural geometries rendered via real-time GPU sphere tracing, analytical gradient normals, ambient occlusion, and dynamic parameter morphing.',
    tags: ['raymarching', 'sdf', 'mandelbulb', 'menger', 'mandelbox', 'julia', 'fractal', '3d', 'shader'],
    moods: ['cosmic', 'hypnotic', 'infinite', 'monumental'],
    defaultParams: {
      seed: '#C084FC',
      fractalType: 'mandelbulb',
      colorPalette: 'spectral-aurora',
      power: 8.0,
      iterations: 8,
      morphParam: 0.0,
      scale: 2.0,
      maxSteps: 90,
      glowIntensity: 1.2,
      specularExp: 32.0,
      ambientOcclusion: 1.0,
      cameraAutoRotate: true,
      rotationSpeed: 0.3,
      camDistance: 2.6,
      cameraFov: 55.0,
    },
    controls: [
      {
        key: 'fractalType',
        label: 'Fractal Topology',
        type: 'select',
        options: [
          { label: 'Mandelbulb (3D)', value: 'mandelbulb' },
          { label: 'Menger Sponge', value: 'menger' },
          { label: 'Mandelbox (3D)', value: 'mandelbox' },
          { label: 'Julia Quaternion', value: 'julia' },
        ],
        folder: 'Topology',
      },
      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Topology',
      },
      { key: 'power', label: 'Order / Power', type: 'slider', min: 2.0, max: 14.0, step: 0.1, folder: 'Fractal Equation' },
      { key: 'iterations', label: 'Max Iterations', type: 'slider', min: 4, max: 16, step: 1, folder: 'Fractal Equation' },
      { key: 'morphParam', label: 'Morph Modulation', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Fractal Equation' },
      { key: 'scale', label: 'Scale Factor', type: 'slider', min: 0.5, max: 4.0, step: 0.1, folder: 'Fractal Equation' },
      { key: 'maxSteps', label: 'Raymarch Steps', type: 'slider', min: 40, max: 160, step: 10, folder: 'Raymarching & Shading' },
      { key: 'glowIntensity', label: 'Atmospheric Glow', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Raymarching & Shading' },
      { key: 'specularExp', label: 'Specular Shine', type: 'slider', min: 8, max: 128, step: 4, folder: 'Raymarching & Shading' },
      { key: 'ambientOcclusion', label: 'Ambient Occlusion', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Raymarching & Shading' },
      { key: 'cameraAutoRotate', label: 'Auto Orbit', type: 'boolean', folder: 'Camera' },
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Camera' },
      { key: 'camDistance', label: 'Camera Distance', type: 'slider', min: 1.2, max: 8.0, step: 0.1, folder: 'Camera' },
      { key: 'cameraFov', label: 'Field of View', type: 'slider', min: 30, max: 90, step: 1, folder: 'Camera' },
    ],
  },

  // Room 12
  {
    id: 'wave-function-collapse',
    index: 12,
    indexDisplay: '#12',
    name: 'Wave Function Collapse',
    category: 'chaos',
    categoryName: 'Chaos & Procedural',
    backend: 'canvas2d',
    backendDisplay: 'CANVAS 2D',
    mathModel: 'Constraint Propagation Procedural Tiling',
    description: 'Quantum-inspired constraint satisfaction algorithm procedurally assembling infinite circuit and architectural mazes.',
    curatorialNote: 'Implements Paul Merrell’s model synthesis and Maxim Gumin’s WFC algorithm with automatic entropy tracking and backtracking.',
    tags: ['wfc', 'wave-function-collapse', 'procedural', 'tiling', 'constraints', 'entropy'],
    moods: ['geometric', 'architectural', 'structured', 'meditative'],
    defaultParams: {
      seed: '#00E676',
      gridSize: 32,
      tileSet: 'circuit',
      collapseSpeed: 4,
      autoRestart: true,
      restartDelay: 3.5,
      symmetryEnforce: false,
      colorPalette: 'spectral-aurora',
      superpositionAlpha: 0.35,
      frontierGlow: 1.2,
      lineWidth: 2.0,
      pointerMode: 'collapse',
      brushRadius: 1,
    },
    controls: [
      { key: 'gridSize', label: 'Grid Resolution', type: 'slider', min: 16, max: 64, step: 4, folder: 'Lattice' },
      {
        key: 'tileSet',
        label: 'Tile Set Preset',
        type: 'select',
        options: [
          { label: 'Cyber Circuit', value: 'circuit' },
          { label: 'Quantum Pipes', value: 'pipes' },
          { label: 'Archival Labyrinth', value: 'labyrinth' },
          { label: 'Gothic Arches', value: 'gothic' },
          { label: 'Dual-Color Wang', value: 'wang' },
        ],
        folder: 'Lattice',
      },
      { key: 'symmetryEnforce', label: 'Enforce Symmetry', type: 'boolean', folder: 'Lattice' },
      { key: 'collapseSpeed', label: 'Collapse Steps / Frame', type: 'slider', min: 1, max: 32, step: 1, folder: 'Solver' },
      { key: 'autoRestart', label: 'Auto-Restart on Solve', type: 'boolean', folder: 'Solver' },
      { key: 'restartDelay', label: 'Restart Delay (s)', type: 'slider', min: 1.0, max: 10.0, step: 0.5, folder: 'Solver' },
      {
        key: 'colorPalette',
        label: 'Color Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Cyber Neon', value: 'cyber-neon' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Aesthetics',
      },
      { key: 'superpositionAlpha', label: 'Superposition Ghosting', type: 'slider', min: 0.0, max: 0.8, step: 0.05, folder: 'Aesthetics' },
      { key: 'frontierGlow', label: 'Frontier Wave Glow', type: 'slider', min: 0.0, max: 2.5, step: 0.1, folder: 'Aesthetics' },
      { key: 'lineWidth', label: 'Vector Line Width', type: 'slider', min: 1.0, max: 5.0, step: 0.5, folder: 'Aesthetics' },
      {
        key: 'pointerMode',
        label: 'Pointer Tool',
        type: 'select',
        options: [
          { label: 'Force Collapse', value: 'collapse' },
          { label: 'Erase Superposition', value: 'erase' },
          { label: 'Pin Blank Tile', value: 'pin-blank' },
          { label: 'Disturb / Scramble', value: 'disturb' },
        ],
        folder: 'Interaction',
      },
      { key: 'brushRadius', label: 'Brush Radius', type: 'slider', min: 1, max: 4, step: 1, folder: 'Interaction' },
    ],
  },

  // Room 13
  {
    id: 'fluid',
    index: 13,
    indexDisplay: '#13',
    name: 'Fluid Dynamics',
    category: 'fluid',
    categoryName: 'Fluid & Surface',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Eulerian Incompressible Navier-Stokes with Vorticity Confinement',
    description: 'Real-time 2D Eulerian fluid simulation solving incompressible Navier-Stokes with curl vorticity confinement, Jacobi pressure Poisson projection, and luminous dye advection.',
    curatorialNote: 'Captures the delicate swirling turbulence and viscous filament dynamics of fluid flows responding instantaneously to pointer impulses.',
    tags: ['fluid', 'navier-stokes', 'smoke', 'vorticity', 'advection', 'dye', 'interactive', 'incompressibility'],
    moods: ['fluid', 'tactile', 'hypnotic', 'responsive'],
    defaultParams: {
      seed: '#38BDF8',
      preset: 'cosmic-nebula',
      colorPalette: 'spectral-aurora',
      vorticity: 26.0,
      viscosity: 0.0008,
      dissipation: 0.992,
      velDissipation: 0.988,
      pressureIterations: 32,
      splatRadius: 0.008,
      splatForce: 1400.0,
      reliefScale: 2.2,
      bloomIntensity: 1.6,
      autonomousFlow: 0.5,
      showVectors: false,
      wrapMode: 'clamp',
    },
    controls: [
      {
        key: 'preset',
        label: 'Fluid Preset',
        type: 'select',
        options: [
          { label: 'Cosmic Nebula (Silky Dust)', value: 'cosmic-nebula' },
          { label: 'Liquid Mercury (Viscous Metal)', value: 'liquid-mercury' },
          { label: 'Electric Plasma (Ionized Swirls)', value: 'electric-plasma' },
          { label: 'Ink in Water (Organic Billows)', value: 'ink-in-water' },
          { label: 'Quantum Vortex (Superfluid)', value: 'quantum-vortex' },
          { label: 'Smoke Plumes (Incense Flow)', value: 'smoke-plumes' },
        ],
        folder: 'Fluid Preset',
      },
      {
        key: 'colorPalette',
        label: 'Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Electric Neon', value: 'electric-neon' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Violet', value: 'cosmic-violet' },
          { label: 'Monochrome Smoke', value: 'monochrome-smoke' },
        ],
        folder: 'Aesthetics & Dye',
      },
      { key: 'vorticity', label: 'Vorticity Confinement', type: 'slider', min: 0.0, max: 50.0, step: 1.0, folder: 'Fluid Physics' },
      { key: 'viscosity', label: 'Kinematic Viscosity (ν)', type: 'slider', min: 0.000, max: 0.030, step: 0.0005, folder: 'Fluid Physics' },
      { key: 'dissipation', label: 'Dye Persistence', type: 'slider', min: 0.920, max: 0.999, step: 0.001, folder: 'Fluid Physics' },
      { key: 'velDissipation', label: 'Velocity Persistence', type: 'slider', min: 0.920, max: 0.999, step: 0.001, folder: 'Fluid Physics' },
      { key: 'pressureIterations', label: 'Pressure Poisson Iterations', type: 'slider', min: 10, max: 60, step: 2, folder: 'Fluid Physics' },
      { key: 'splatRadius', label: 'Impulse Radius', type: 'slider', min: 0.002, max: 0.025, step: 0.001, folder: 'Interaction & Force' },
      { key: 'splatForce', label: 'Impulse Force', type: 'slider', min: 200.0, max: 3000.0, step: 100.0, folder: 'Interaction & Force' },
      { key: 'reliefScale', label: '3D Normal Relief', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: 'Aesthetics & Dye' },
      { key: 'bloomIntensity', label: 'Luminous Glow', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Aesthetics & Dye' },
      { key: 'autonomousFlow', label: 'Ambient Swirls', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Field Dynamics' },
      {
        key: 'wrapMode',
        label: 'Boundary Mode',
        type: 'select',
        options: [
          { label: 'Solid Wall (Clamp)', value: 'clamp' },
          { label: 'Periodic Wrap', value: 'wrap' },
        ],
        folder: 'Field Dynamics',
      },
    ],
  },

  // Room 14
  {
    id: 'metaballs',
    index: 14,
    indexDisplay: '#14',
    name: 'Metaballs & Marching Cubes',
    category: 'fluid',
    categoryName: 'Fluid & Surface',
    backend: 'webgl2',
    backendDisplay: 'WEBGL2',
    mathModel: 'GPU Marching Cubes Density Isosurface',
    description: 'Liquid mercury metaball clusters meshed in real-time using the 3D Marching Cubes polygonization algorithm.',
    curatorialNote: 'Translates 3D scalar potential fields into smooth, organic polygon surfaces with dynamic physical surface tension.',
    tags: ['metaballs', 'marching-cubes', 'isosurface', '3d', 'liquid', 'mercury', 'polygons'],
    moods: ['tactile', 'fluid', 'monumental', 'sculptural'],
    defaultParams: {
      seed: '#F59E0B',
      preset: 'liquid-mercury',
      materialMode: 'liquid-mercury',
      colorPalette: 'mercury-chrome',
      ballCount: 20,
      isolationThreshold: 68.0,
      meshResolution: 36,
      clusterSpeed: 0.8,
      blobScale: 1.0,
      roughness: 0.08,
      metalness: 0.94,
      transmission: 0.0,
      iridescence: 0.4,
      wireframe: false,
      cameraAutoRotate: true,
      rotationSpeed: 0.5,
      gravityStrength: 1.0,
      audioReactivity: 1.0,
    },
    controls: [
      {
        key: 'preset',
        label: 'Cluster Preset',
        type: 'select',
        options: [
          { label: 'Liquid Mercury', value: 'liquid-mercury' },
          { label: 'Orbital Cluster', value: 'orbital-cluster' },
          { label: 'Chaotic Swarm', value: 'chaotic-swarm' },
          { label: 'Pulsing Core', value: 'pulsing-core' },
          { label: 'Repulsion Drift', value: 'repulsion-drift' },
          { label: 'Quantum Lattice', value: 'quantum-lattice' },
        ],
        folder: 'Simulation',
      },
      { key: 'ballCount', label: 'Metaball Count', type: 'slider', min: 6, max: 48, step: 1, folder: 'Simulation' },
      { key: 'clusterSpeed', label: 'Evolution Speed', type: 'slider', min: 0.1, max: 3.0, step: 0.1, folder: 'Simulation' },
      { key: 'gravityStrength', label: 'Gravity Cohesion', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Simulation' },
      { key: 'isolationThreshold', label: 'Surface Tension (Isovalue)', type: 'slider', min: 25.0, max: 110.0, step: 1.0, folder: 'Marching Cubes' },
      { key: 'meshResolution', label: 'Voxel Resolution', type: 'slider', min: 24, max: 56, step: 2, folder: 'Marching Cubes' },
      { key: 'blobScale', label: 'Blob Radius Scale', type: 'slider', min: 0.5, max: 2.0, step: 0.05, folder: 'Marching Cubes' },
      { key: 'wireframe', label: 'Wireframe Mesh', type: 'boolean', folder: 'Marching Cubes' },
      {
        key: 'materialMode',
        label: 'Surface Material',
        type: 'select',
        options: [
          { label: 'Liquid Mercury Chrome', value: 'liquid-mercury' },
          { label: 'Obsidian Dark Glass', value: 'obsidian-glass' },
          { label: 'Gold Specular Lustre', value: 'gold-specular' },
          { label: 'Iridescent Pearl', value: 'iridescent-pearl' },
          { label: 'Bioluminescent Plasma', value: 'bioluminescent-plasma' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Material & Optics',
      },
      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Mercury Chrome', value: 'mercury-chrome' },
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Void', value: 'monochrome-void' },
        ],
        folder: 'Material & Optics',
      },
      { key: 'roughness', label: 'Surface Roughness', type: 'slider', min: 0.0, max: 1.0, step: 0.02, folder: 'Material & Optics' },
      { key: 'metalness', label: 'Metallic Factor', type: 'slider', min: 0.0, max: 1.0, step: 0.02, folder: 'Material & Optics' },
      { key: 'transmission', label: 'Glass Transmission', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Material & Optics' },
      { key: 'iridescence', label: 'Iridescence Sheen', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Material & Optics' },
      { key: 'cameraAutoRotate', label: 'Auto Orbit Camera', type: 'boolean', folder: 'Camera & Dynamics' },
      { key: 'rotationSpeed', label: 'Orbit Rate', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Camera & Dynamics' },
      { key: 'audioReactivity', label: 'Audio Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Camera & Dynamics' },
    ],
  },

  // Room 15
  {
    id: 'galaxy',
    index: 15,
    indexDisplay: '#15',
    name: 'Galaxy Fly-Through',
    category: 'cosmic',
    categoryName: 'Cosmic',
    backend: 'webgpu-compute',
    backendDisplay: 'WEBGPU COMPUTE',
    mathModel: 'Density Wave Theory & Spiral Core Mechanics',
    description: 'Astronomical simulation of a barred spiral galaxy with 500,000+ stars and volumetric interstellar gas clouds.',
    curatorialNote: 'Computes stellar orbital mechanics based on Lin-Shu density wave theory, galactic core dark matter distribution, and cosmic dust lanes.',
    tags: ['galaxy', 'stars', 'astronomy', 'spiral', 'nebula', 'cosmic', 'compute'],
    moods: ['cosmic', 'meditative', 'monumental', 'infinite'],
    defaultParams: {
      seed: '#E0AAFF',
      preset: 'milky-way',
      starCount: 300000,
      spiralArms: 4,
      armWinding: 2.8,
      armWidth: 0.4,
      barLength: 1.2,
      coreBulgeRadius: 2.5,
      haloDensity: 0.35,
      rotationSpeed: 0.6,
      densityWaveAmp: 0.8,
      dustDensity: 1.0,
      starSize: 1.8,
      scintillation: 0.8,
      cameraMode: 'fly-through',
      cameraSpeed: 0.4,
      cameraFov: 55,
      colorPalette: 'stellar-blackbody',
      nebulaGlow: 1.2,
      audioReactivity: 1.2,
    },
    controls: [
      {
        key: 'preset',
        label: 'Morphology',
        type: 'select',
        options: [
          { label: 'Milky Way Barred', value: 'milky-way' },
          { label: 'Andromeda Grand Design', value: 'andromeda' },
          { label: 'Pinwheel Multi-Arm', value: 'pinwheel' },
          { label: 'Sombrero Dense Bulge', value: 'sombrero' },
          { label: 'Hoag Ring Galaxy', value: 'ring-galaxy' },
          { label: 'Starburst Collision', value: 'starburst' },
        ],
        folder: 'Galactic Structure',
      },
      { key: 'starCount', label: 'Star Count', type: 'slider', min: 50000, max: 600000, step: 25000, folder: 'Galactic Structure' },
      { key: 'spiralArms', label: 'Spiral Arms (N)', type: 'slider', min: 1, max: 8, step: 1, folder: 'Galactic Structure' },
      { key: 'armWinding', label: 'Arm Twist Angle', type: 'slider', min: 0.5, max: 6.0, step: 0.1, folder: 'Galactic Structure' },
      { key: 'armWidth', label: 'Arm Dispersion', type: 'slider', min: 0.1, max: 1.5, step: 0.05, folder: 'Galactic Structure' },
      { key: 'barLength', label: 'Bar Length', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Galactic Structure' },
      { key: 'coreBulgeRadius', label: 'Core Bulge Size', type: 'slider', min: 0.5, max: 5.0, step: 0.1, folder: 'Galactic Structure' },
      { key: 'haloDensity', label: 'Halo Cluster Density', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Galactic Structure' },
      { key: 'rotationSpeed', label: 'Galactic Spin Rate', type: 'slider', min: 0.0, max: 3.0, step: 0.05, folder: 'Astrophysics & Dynamics' },
      { key: 'densityWaveAmp', label: 'Density Wave Amp', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Astrophysics & Dynamics' },
      { key: 'dustDensity', label: 'Interstellar Dust Opacity', type: 'slider', min: 0.0, max: 2.5, step: 0.1, folder: 'Astrophysics & Dynamics' },
      { key: 'starSize', label: 'Star Point Scale', type: 'slider', min: 0.5, max: 4.0, step: 0.1, folder: 'Astrophysics & Dynamics' },
      { key: 'scintillation', label: 'Stellar Twinkle Rate', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Astrophysics & Dynamics' },
      {
        key: 'cameraMode',
        label: 'Camera Mode',
        type: 'select',
        options: [
          { label: 'Autonomous Fly-Through', value: 'fly-through' },
          { label: 'Manual Orbit', value: 'manual-orbit' },
        ],
        folder: 'Camera & Aesthetics',
      },
      { key: 'cameraSpeed', label: 'Cruising Speed', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Camera & Aesthetics' },
      { key: 'cameraFov', label: 'Camera FOV', type: 'slider', min: 35, max: 85, step: 5, folder: 'Camera & Aesthetics' },
      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Stellar Blackbody (OBAFGKM)', value: 'stellar-blackbody' },
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Deep Cosmos (JWST)', value: 'deep-cosmos' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Void', value: 'monochrome-void' },
        ],
        folder: 'Camera & Aesthetics',
      },
      { key: 'nebulaGlow', label: 'Nebular Luminescence', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Camera & Aesthetics' },
      { key: 'audioReactivity', label: 'Audio Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Camera & Aesthetics' },
    ],
  },

  // Room 16
  {
    id: 'kaleidoscope',
    index: 16,
    indexDisplay: '#16',
    name: 'Kaleidoscope',
    category: 'audio',
    categoryName: 'Audio Reactive',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'N-Fold Radial Reflection & Real-Time FFT Warping',
    description: 'Audio-reactive kaleidoscopic optical chamber driven by Web Audio FFT spectral bands and radial symmetry folding.',
    curatorialNote: 'Synthesizes sound and light into synchronized geometric mandalas, reacting dynamically to bass pulses and high-frequency overtones.',
    tags: ['kaleidoscope', 'symmetry', 'audio-reactive', 'fft', 'mandala', 'spectral', 'sound'],
    moods: ['audio', 'psychedelic', 'hypnotic', 'vibrant'],
    defaultParams: {
      seed: '#FF2A6D',
      preset: 'crystal-mandala',
      symmetrySegments: 12,
      iterations: 5,
      zoom: 1.2,
      zoomSpeed: 0.2,
      rotationSpeed: 0.25,
      warpStrength: 0.8,
      hyperbolicScale: 0.4,
      audioSource: 'synth',
      audioSensitivity: 1.6,
      bassReaction: 1.4,
      midReaction: 1.2,
      trebleReaction: 1.5,
      chromaticAberration: 0.018,
      glowIntensity: 1.4,
      reliefScale: 2.2,
      colorPalette: 'spectral-aurora',
      colorCycleSpeed: 0.4,
    },
    controls: [
      {
        key: 'preset',
        label: 'Mandala Preset',
        type: 'select',
        options: [
          { label: 'Crystal Mandala (12-Fold)', value: 'crystal-mandala' },
          { label: 'Cosmic Rosette (8-Fold)', value: 'cosmic-rosette' },
          { label: 'Sacred Geometry (6-Fold)', value: 'sacred-geometry' },
          { label: 'Hyper Dimension (16-Fold)', value: 'hyper-dimension' },
          { label: 'Flower of Life (10-Fold)', value: 'flower-of-life' },
          { label: 'Quantum Lattice (6-Fold)', value: 'quantum-lattice' },
        ],
        folder: 'Optics & Symmetry',
      },
      { key: 'symmetrySegments', label: 'Symmetry Folds (N)', type: 'slider', min: 3, max: 24, step: 1, folder: 'Optics & Symmetry' },
      { key: 'iterations', label: 'Reflection Depth', type: 'slider', min: 1, max: 8, step: 1, folder: 'Optics & Symmetry' },
      { key: 'zoom', label: 'Tunnel Zoom', type: 'slider', min: 0.2, max: 4.0, step: 0.1, folder: 'Optics & Symmetry' },
      { key: 'zoomSpeed', label: 'Continuous Zoom Rate', type: 'slider', min: -1.0, max: 2.0, step: 0.05, folder: 'Optics & Symmetry' },
      { key: 'rotationSpeed', label: 'Rotation Rate', type: 'slider', min: -2.0, max: 2.0, step: 0.05, folder: 'Optics & Symmetry' },
      { key: 'warpStrength', label: 'Domain Warping', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Geometry & Tiling' },
      { key: 'hyperbolicScale', label: 'Hyperbolic Inversion', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Geometry & Tiling' },
      {
        key: 'audioSource',
        label: 'Audio Input Source',
        type: 'select',
        options: [
          { label: 'Ambient Synth (Zero-Permission)', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Muted (Passive)', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Global Audio Sensitivity', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'bassReaction', label: 'Bass Reaction (Zoom/Pulse)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'midReaction', label: 'Mid Reaction (Spin/Warp)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'trebleReaction', label: 'Treble Reaction (Dispersion)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Void', value: 'monochrome-void' },
        ],
        folder: 'Aesthetics & Optics',
      },
      { key: 'chromaticAberration', label: 'Chromatic Dispersion', type: 'slider', min: 0.0, max: 0.05, step: 0.002, folder: 'Aesthetics & Optics' },
      { key: 'glowIntensity', label: 'Core Luminescence', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Aesthetics & Optics' },
      { key: 'reliefScale', label: '3D Normal Relief', type: 'slider', min: 0.0, max: 4.0, step: 0.1, folder: 'Aesthetics & Optics' },
      { key: 'colorCycleSpeed', label: 'Color Harmonic Drift', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Aesthetics & Optics' },
    ],
  },

  // Room 17
  {
    id: 'fractal-flames',
    index: 17,
    indexDisplay: '#17',
    name: 'Fractal Flames',
    category: 'psychedelic',
    categoryName: 'Psychedelic & Optical',
    backend: 'webgl2',
    backendDisplay: 'WEBGL2 / TSL',
    mathModel: "Scott Draves' Non-linear IFS & Log-Density Tone Mapping",
    description: 'Non-linear chaotic iterated function system evaluated across 300,000+ points with Scott Draves log-density tone mapping.',
    curatorialNote: 'Realizes the revolutionary 1992 Draves flame algorithm, combining non-linear spatial variations, path-based structural coloring, and high-dynamic-range filament accumulation.',
    tags: ['fractal', 'flames', 'ifs', 'chaos', 'log-density', 'tone-mapping', 'scott-draves', 'variations', 'swirl', 'spherical', 'attractor'],
    moods: ['psychedelic', 'hypnotic', 'intricate', 'luminous', 'cosmic'],
    defaultParams: {
      seed: '#FF2A6D',
      preset: 'phoenix-nebula',
      pointCount: 300000,
      iterationsPerFrame: 3,
      transformCount: 4,
      symmetryFold: 2,
      gamma: 2.2,
      brightness: 3.0,
      vibrance: 1.2,
      pointSize: 1.6,
      glowIntensity: 1.2,
      zoom: 1.1,
      panX: 0.0,
      panY: 0.0,
      rotationSpeed: 0.2,
      autoRotate: true,
      colorPalette: 'spectral-aurora',
      linearWeight: 0.3,
      sinusoidalWeight: 0.4,
      sphericalWeight: 0.6,
      swirlWeight: 0.8,
      horseshoeWeight: 0.0,
      polarWeight: 0.0,
      handkerchiefWeight: 0.0,
      heartWeight: 0.0,
      discWeight: 0.0,
      spiralWeight: 0.0,
      hyperbolicWeight: 0.0,
      audioSource: 'synth',
      audioSensitivity: 1.5,
    },
    controls: [
      {
        key: 'preset',
        label: 'Morphology Preset',
        type: 'select',
        options: [
          { label: 'Phoenix Nebula', value: 'phoenix-nebula' },
          { label: 'Dragon Spirals', value: 'dragon-spirals' },
          { label: 'Cosmic Cross', value: 'cosmic-cross' },
          { label: 'Hyperbolic Bloom', value: 'hyperbolic-bloom' },
          { label: 'Quantum Crystal', value: 'quantum-crystal' },
          { label: 'Solar Corona', value: 'solar-corona' },
          { label: 'Abyssal Vortex', value: 'abyssal-vortex' },
          { label: 'Sierpinski Chaos', value: 'sierpinski-chaos' },
        ],
        folder: 'Morphology & Presets',
      },
      { key: 'pointCount', label: 'Point Cloud Capacity', type: 'slider', min: 50000, max: 600000, step: 10000, folder: 'Morphology & Presets' },
      { key: 'iterationsPerFrame', label: 'Iteration Steps / Frame', type: 'slider', min: 1, max: 8, step: 1, folder: 'Morphology & Presets' },
      { key: 'transformCount', label: 'Transform Count', type: 'slider', min: 2, max: 6, step: 1, folder: 'Morphology & Presets' },
      { key: 'symmetryFold', label: 'Rotational Symmetry', type: 'slider', min: 1, max: 8, step: 1, folder: 'Morphology & Presets' },

      { key: 'linearWeight', label: 'V0: Linear', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'sinusoidalWeight', label: 'V1: Sinusoidal', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'sphericalWeight', label: 'V2: Spherical', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'swirlWeight', label: 'V3: Swirl', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'horseshoeWeight', label: 'V4: Horseshoe', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'polarWeight', label: 'V5: Polar', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'handkerchiefWeight', label: 'V6: Handkerchief', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'heartWeight', label: 'V7: Heart', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'discWeight', label: 'V8: Disc', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'spiralWeight', label: 'V9: Spiral', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },
      { key: 'hyperbolicWeight', label: 'V10: Hyperbolic', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Non-Linear Variations' },

      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Void', value: 'monochrome-void' },
          { label: 'Electric Fire', value: 'electric-fire' },
        ],
        folder: 'Log-Density Tone Mapping & Optics',
      },
      { key: 'brightness', label: 'Exposure (κ)', type: 'slider', min: 0.5, max: 8.0, step: 0.1, folder: 'Log-Density Tone Mapping & Optics' },
      { key: 'gamma', label: 'Gamma (γ)', type: 'slider', min: 0.8, max: 3.5, step: 0.05, folder: 'Log-Density Tone Mapping & Optics' },
      { key: 'vibrance', label: 'Color Vibrance', type: 'slider', min: 0.2, max: 2.5, step: 0.05, folder: 'Log-Density Tone Mapping & Optics' },
      { key: 'pointSize', label: 'Starlight Point Size', type: 'slider', min: 0.5, max: 4.0, step: 0.1, folder: 'Log-Density Tone Mapping & Optics' },
      { key: 'glowIntensity', label: 'Core Radiance', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Log-Density Tone Mapping & Optics' },

      { key: 'zoom', label: 'Viewport Zoom', type: 'slider', min: 0.2, max: 4.0, step: 0.05, folder: 'View & Kinematics' },
      { key: 'autoRotate', label: 'Kinematic Auto-Rotate', type: 'boolean', folder: 'View & Kinematics' },
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'View & Kinematics' },

      {
        key: 'audioSource',
        label: 'Audio Reactivity',
        type: 'select',
        options: [
          { label: 'Ambient Drone Synth', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Disabled / Muted', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Spectral Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
    ],
  },

  // Room 18
  {
    id: 'video-feedback',
    index: 18,
    indexDisplay: '#18',
    name: 'Video Feedback Loop',
    category: 'psychedelic',
    categoryName: 'Psychedelic & Optical',
    backend: 'webgl2',
    backendDisplay: 'WEBGL2 / FBO',
    mathModel: 'Multi-Pass Ping-Pong Framebuffer Feedback & Optical Aberration',
    description: 'Analog cathode-ray video feedback loop simulated via ping-pong framebuffers with parameterized spatial transformation, optical distortion, and cursor injection.',
    curatorialNote: 'Recreates the hypnotic self-referential aesthetics of pointing an analog video camera at its own monitor, giving rise to infinite recursive fractal corridors, spiraling mandalas, and chromatic dispersion.',
    tags: ['video-feedback', 'ping-pong', 'fbo', 'crt', 'feedback-loop', 'distortion', 'chromatic-aberration', 'fractal-spirals', 'psychedelic', 'analog', 'recursion'],
    moods: ['psychedelic', 'hypnotic', 'infinite', 'analog', 'trippy'],
    defaultParams: {
      seed: '#00F0FF',
      preset: 'infinite-tunnel',
      zoom: 1.025,
      rotation: 0.015,
      decay: 0.978,
      hueShift: 0.008,
      chromaticAberration: 0.012,
      distortion: -0.05,
      distortionK2: 0.0,
      saturation: 1.15,
      brightness: 1.05,
      contrast: 1.10,
      colorPalette: 'spectral-aurora',
      injectionShape: 'ring',
      injectionSize: 0.09,
      injectionSpeed: 1.0,
      injectionIntensity: 0.85,
      brushRadius: 22,
      brushIntensity: 1.0,
      lfoZoom: 0.015,
      lfoRotation: 0.008,
      lfoSpeed: 0.5,
      audioSource: 'synth',
      audioSensitivity: 1.5,
    },
    controls: [
      {
        key: 'preset',
        label: 'Morphology Preset',
        type: 'select',
        options: [
          { label: 'Infinite Tunnel', value: 'infinite-tunnel' },
          { label: 'Fractal Spiral', value: 'fractal-spiral' },
          { label: 'CRT Phosphor', value: 'crt-phosphor' },
          { label: 'Kaleido Drift', value: 'kaleido-drift' },
          { label: 'Solar Corona', value: 'solar-corona' },
          { label: 'Quantum Lattice', value: 'quantum-lattice' },
          { label: 'Cyber Glitch', value: 'cyber-glitch' },
          { label: 'Abyssal Vortex', value: 'abyssal-vortex' },
        ],
        folder: 'Morphology & Presets',
      },
      { key: 'zoom', label: 'Spatial Zoom (S)', type: 'slider', min: 0.85, max: 1.20, step: 0.005, folder: 'Spatial Transformation' },
      { key: 'rotation', label: 'Rotation Angle (θ)', type: 'slider', min: -0.10, max: 0.10, step: 0.002, folder: 'Spatial Transformation' },
      { key: 'distortion', label: 'Lens Distortion (k1)', type: 'slider', min: -0.50, max: 0.50, step: 0.01, folder: 'Spatial Transformation' },
      { key: 'distortionK2', label: 'Higher-Order (k2)', type: 'slider', min: -0.20, max: 0.20, step: 0.01, folder: 'Spatial Transformation' },
      { key: 'chromaticAberration', label: 'Chromatic Dispersion (δ)', type: 'slider', min: 0.0, max: 0.05, step: 0.002, folder: 'Spatial Transformation' },

      {
        key: 'colorPalette',
        label: 'Spectral Palette',
        type: 'select',
        options: [
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Phosphor CRT', value: 'phosphor-crt' },
          { label: 'Cyber Neon', value: 'cyber-neon' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Void', value: 'monochrome-void' },
        ],
        folder: 'Color Grading & Persistence',
      },
      { key: 'decay', label: 'Persistence / Decay', type: 'slider', min: 0.90, max: 0.999, step: 0.002, folder: 'Color Grading & Persistence' },
      { key: 'hueShift', label: 'Hue Drift Rate (ΔH)', type: 'slider', min: -0.05, max: 0.05, step: 0.002, folder: 'Color Grading & Persistence' },
      { key: 'saturation', label: 'Saturation Boost', type: 'slider', min: 0.5, max: 2.5, step: 0.05, folder: 'Color Grading & Persistence' },
      { key: 'brightness', label: 'Exposure Gain', type: 'slider', min: 0.5, max: 2.0, step: 0.05, folder: 'Color Grading & Persistence' },
      { key: 'contrast', label: 'Non-linear Contrast', type: 'slider', min: 0.5, max: 2.0, step: 0.05, folder: 'Color Grading & Persistence' },

      {
        key: 'injectionShape',
        label: 'Seed Pattern',
        type: 'select',
        options: [
          { label: 'Pulsating Ring', value: 'ring' },
          { label: '5-Point Star', value: 'star' },
          { label: 'Archimedean Spiral', value: 'spiral' },
          { label: 'Hexagon Polygon', value: 'polygon' },
          { label: 'Lissajous Knot', value: 'lissajous' },
          { label: 'Crosshair Reticle', value: 'cross' },
          { label: 'None (Pure Feedback)', value: 'none' },
        ],
        folder: 'Input Injection & Seeds',
      },
      { key: 'injectionSize', label: 'Pattern Size', type: 'slider', min: 0.02, max: 0.35, step: 0.01, folder: 'Input Injection & Seeds' },
      { key: 'injectionSpeed', label: 'Spin Velocity', type: 'slider', min: -3.0, max: 3.0, step: 0.1, folder: 'Input Injection & Seeds' },
      { key: 'injectionIntensity', label: 'Seed Brightness', type: 'slider', min: 0.0, max: 2.0, step: 0.05, folder: 'Input Injection & Seeds' },
      { key: 'brushRadius', label: 'Cursor Brush Radius', type: 'slider', min: 5, max: 80, step: 1, folder: 'Input Injection & Seeds' },
      { key: 'brushIntensity', label: 'Cursor Light Power', type: 'slider', min: 0.1, max: 2.0, step: 0.05, folder: 'Input Injection & Seeds' },

      { key: 'lfoZoom', label: 'LFO Zoom Modulation', type: 'slider', min: 0.0, max: 0.08, step: 0.002, folder: 'LFO & Dynamics' },
      { key: 'lfoRotation', label: 'LFO Rotation Modulation', type: 'slider', min: 0.0, max: 0.05, step: 0.002, folder: 'LFO & Dynamics' },
      { key: 'lfoSpeed', label: 'LFO Rate', type: 'slider', min: 0.0, max: 3.0, step: 0.05, folder: 'LFO & Dynamics' },

      {
        key: 'audioSource',
        label: 'Audio Reactivity',
        type: 'select',
        options: [
          { label: 'Ambient Drone Synth', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Disabled / Muted', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Spectral Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
    ],
  },

  // Room 19
  {
    id: 'plasma',
    index: 19,
    indexDisplay: '#19',
    name: 'Plasma Field',
    category: 'psychedelic',
    categoryName: 'Psychedelic & Optical',
    backend: 'tsl-shader',
    backendDisplay: 'TSL SHADER',
    mathModel: 'Multi-Wave Trigonometric Interference & Palette Cycling',
    description: 'Classic demoscene multi-source sine wave interference with Inigo Quilez cosine gradient color cycling and non-linear phase distortion.',
    curatorialNote: 'Synthesizes organic fluid optical interference through analytical superposition of spatial wave vectors, non-linear domain warping, and smooth cosine palette mapping.',
    tags: ['plasma', 'demoscene', 'trigonometric', 'interference', 'cosine-gradient', 'inigo-quilez', 'shader', 'tsl', 'waves'],
    moods: ['hypnotic', 'psychedelic', 'vibrant', 'liquid', 'retro', 'optical'],
    defaultParams: {
      seed: '#00F0FF',
      preset: 'classic-demoscene',
      k1: 3.0,
      k2: 3.0,
      k3: 4.0,
      k4: 5.0,
      waveAngle: 0.785,
      warpStrength: 0.35,
      warpFrequency: 2.0,
      animSpeed: 0.9,
      colorCycleSpeed: 0.6,
      colorCycles: 1.0,
      contrast: 1.25,
      brightness: 0.0,
      colorPalette: 'rainbow-demoscene',
      rippleStrength: 1.2,
      rippleFrequency: 14.0,
      audioSource: 'synth',
      audioSensitivity: 1.0,
      bassReaction: 1.2,
      midReaction: 1.0,
      trebleReaction: 1.4,
    },
    controls: [
      {
        key: 'preset',
        label: 'Canonical Preset',
        type: 'select',
        options: [
          { label: 'Classic Demoscene', value: 'classic-demoscene' },
          { label: 'Liquid Neon', value: 'liquid-neon' },
          { label: 'Obsidian Gold', value: 'obsidian-gold' },
          { label: 'Acid Vortex', value: 'acid-vortex' },
          { label: 'Quantum Ripples', value: 'quantum-ripples' },
          { label: 'Cosmic Aurora', value: 'cosmic-aurora' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Preset & Palettes',
      },
      {
        key: 'colorPalette',
        label: 'Cosine Palette',
        type: 'select',
        options: [
          { label: 'Rainbow Demoscene', value: 'rainbow-demoscene' },
          { label: 'Neon Cyan / Magenta', value: 'neon-cyan-magenta' },
          { label: 'Obsidian Gold', value: 'obsidian-gold' },
          { label: 'Acid Green', value: 'acid-green' },
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Monochrome Lithic', value: 'monochrome-lithic' },
        ],
        folder: 'Preset & Palettes',
      },
      { key: 'colorCycleSpeed', label: 'Color Cycle Speed', type: 'slider', min: 0.0, max: 3.0, step: 0.05, folder: 'Preset & Palettes' },
      { key: 'colorCycles', label: 'Color Cycles / Freq', type: 'slider', min: 0.5, max: 5.0, step: 0.1, folder: 'Preset & Palettes' },

      { key: 'k1', label: 'Wave 1 Freq (X)', type: 'slider', min: 0.5, max: 15.0, step: 0.1, folder: 'Wave Harmonics' },
      { key: 'k2', label: 'Wave 2 Freq (Y)', type: 'slider', min: 0.5, max: 15.0, step: 0.1, folder: 'Wave Harmonics' },
      { key: 'k3', label: 'Wave 3 Freq (Diag)', type: 'slider', min: 0.5, max: 15.0, step: 0.1, folder: 'Wave Harmonics' },
      { key: 'k4', label: 'Wave 4 Freq (Radial)', type: 'slider', min: 0.5, max: 25.0, step: 0.2, folder: 'Wave Harmonics' },
      { key: 'waveAngle', label: 'Diagonal Angle (θ)', type: 'slider', min: 0.0, max: 3.14, step: 0.05, folder: 'Wave Harmonics' },
      { key: 'animSpeed', label: 'Evolution Speed', type: 'slider', min: 0.0, max: 3.0, step: 0.05, folder: 'Wave Harmonics' },

      { key: 'warpStrength', label: 'Domain Warp Power', type: 'slider', min: 0.0, max: 3.0, step: 0.05, folder: 'Domain Warping & Tone' },
      { key: 'warpFrequency', label: 'Warp Frequency', type: 'slider', min: 0.5, max: 10.0, step: 0.1, folder: 'Domain Warping & Tone' },
      { key: 'contrast', label: 'Contrast', type: 'slider', min: 0.5, max: 3.0, step: 0.05, folder: 'Domain Warping & Tone' },
      { key: 'brightness', label: 'Brightness Offset', type: 'slider', min: -0.5, max: 0.5, step: 0.02, folder: 'Domain Warping & Tone' },

      { key: 'rippleStrength', label: 'Cursor Wave Power', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Cursor Ripple Dynamics' },
      { key: 'rippleFrequency', label: 'Ripple Frequency', type: 'slider', min: 2.0, max: 30.0, step: 0.5, folder: 'Cursor Ripple Dynamics' },

      {
        key: 'audioSource',
        label: 'Audio Reactivity',
        type: 'select',
        options: [
          { label: 'Ambient Drone Synth', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Disabled / Muted', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Spectral Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'bassReaction', label: 'Bass Reaction', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'midReaction', label: 'Mid Reaction', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'trebleReaction', label: 'Treble Reaction', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
    ],
  },

  // Room 20
  {
    id: 'cymatics',
    index: 20,
    indexDisplay: '#20',
    name: 'Cymatics & Chladni Resonance',
    category: 'psychedelic',
    categoryName: 'Psychedelic & Optical',
    backend: 'tsl-shader',
    backendDisplay: 'THREE.JS / SHADER',
    mathModel: '2D Standing Acoustic Plate Wave Potential & Bessel Modal Eigenfunctions',
    description: 'Dynamic acoustic standing wave nodal particles on vibrating square and circular Chladni plates.',
    curatorialNote: 'Visualizes Ernst Chladni and Hans Jenny cymatic resonance, guiding 50,000+ granular sand particles into intricate geometric nodal curves driven by acoustic frequency spectra.',
    tags: ['cymatics', 'chladni', 'acoustics', 'standing-waves', 'resonance', 'particles', 'bessel', 'sound'],
    moods: ['hypnotic', 'sacred', 'meditative', 'geometric', 'resonant'],
    defaultParams: {
      seed: '#D4AF37',
      preset: 'fundamental-square',
      plateShape: 'square',
      modeN: 2,
      modeM: 2,
      paramA: 1.0,
      paramB: 1.0,
      frequency: 432,
      particleCount: 50000,
      vibrationPower: 1.8,
      driftStrength: 2.8,
      friction: 0.05,
      bounceHeight: 1.2,
      gravity: 9.8,
      colorPalette: 'sand-gold',
      particleSize: 1.6,
      sparkGlow: 1.2,
      plateOpacity: 0.85,
      cameraView: 'isometric-3d',
      cameraAutoRotate: false,
      rotationSpeed: 0.3,
      pointerImpulse: 2.0,
      shockwavePower: 2.5,
      sandDropRate: 200,
      audioSource: 'synth',
      audioSensitivity: 1.0,
      bassReaction: 1.2,
      trebleReaction: 1.0,
    },
    controls: [
      {
        key: 'preset',
        label: 'Acoustic Preset',
        type: 'select',
        options: [
          { label: 'Fundamental Square (Chladni Cross)', value: 'fundamental-square' },
          { label: 'Sacred Mandala (8-Fold Radial Flower)', value: 'sacred-mandala' },
          { label: 'High-Harmonic Lattice (Matrix)', value: 'high-harmonic-lattice' },
          { label: 'Bessel Circular (Starburst)', value: 'bessel-circular' },
          { label: 'Quantum Resonance (Asymmetric)', value: 'quantum-resonance' },
          { label: 'Chaotic Dispersion (Storm)', value: 'chaotic-dispersion' },
        ],
        folder: 'Modal Vibration & Geometry',
      },
      {
        key: 'plateShape',
        label: 'Plate Geometry',
        type: 'select',
        options: [
          { label: 'Square Plate (Chladni W)', value: 'square' },
          { label: 'Circular Plate (Bessel Jn)', value: 'circular' },
        ],
        folder: 'Modal Vibration & Geometry',
      },
      { key: 'modeN', label: 'Harmonic Mode (n)', type: 'slider', min: 1, max: 12, step: 1, folder: 'Modal Vibration & Geometry' },
      { key: 'modeM', label: 'Harmonic Mode (m)', type: 'slider', min: 1, max: 12, step: 1, folder: 'Modal Vibration & Geometry' },
      { key: 'paramA', label: 'Mode Weight A', type: 'slider', min: 0.1, max: 3.0, step: 0.1, folder: 'Modal Vibration & Geometry' },
      { key: 'paramB', label: 'Mode Weight B', type: 'slider', min: 0.1, max: 3.0, step: 0.1, folder: 'Modal Vibration & Geometry' },
      { key: 'frequency', label: 'Oscillation Freq (Hz)', type: 'slider', min: 50, max: 2000, step: 10, folder: 'Modal Vibration & Geometry' },

      { key: 'particleCount', label: 'Sand Particle Count', type: 'slider', min: 10000, max: 100000, step: 5000, folder: 'Granular Physics' },
      { key: 'vibrationPower', label: 'Vibration Power', type: 'slider', min: 0.2, max: 5.0, step: 0.1, folder: 'Granular Physics' },
      { key: 'driftStrength', label: 'Nodal Drift Force', type: 'slider', min: 0.5, max: 6.0, step: 0.1, folder: 'Granular Physics' },
      { key: 'friction', label: 'Plate Friction', type: 'slider', min: 0.01, max: 0.20, step: 0.01, folder: 'Granular Physics' },
      { key: 'bounceHeight', label: '3D Bounce Height', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Granular Physics' },
      { key: 'gravity', label: 'Gravity Acceleration', type: 'slider', min: 2.0, max: 20.0, step: 0.5, folder: 'Granular Physics' },

      {
        key: 'colorPalette',
        label: 'Color Palette',
        type: 'select',
        options: [
          { label: 'Sand Gold (Natural Quartz)', value: 'sand-gold' },
          { label: 'Spectral Aurora', value: 'spectral-aurora' },
          { label: 'Obsidian Emerald', value: 'obsidian-emerald' },
          { label: 'Cosmic Amethyst', value: 'cosmic-amethyst' },
          { label: 'Phosphor Cyan', value: 'phosphor-cyan' },
          { label: 'Monochrome Salt (NaCl)', value: 'monochrome-salt' },
        ],
        folder: 'Aesthetics & Viewport',
      },
      { key: 'particleSize', label: 'Grain Size', type: 'slider', min: 0.5, max: 4.0, step: 0.1, folder: 'Aesthetics & Viewport' },
      { key: 'sparkGlow', label: 'Friction Spark Luminescence', type: 'slider', min: 0.2, max: 3.0, step: 0.1, folder: 'Aesthetics & Viewport' },
      { key: 'plateOpacity', label: 'Plate Opacity', type: 'slider', min: 0.0, max: 1.0, step: 0.05, folder: 'Aesthetics & Viewport' },
      {
        key: 'cameraView',
        label: 'Camera Perspective',
        type: 'select',
        options: [
          { label: 'Isometric 3D', value: 'isometric-3d' },
          { label: 'Top-Down 2D', value: 'top-down' },
          { label: 'Angled Cinematic', value: 'angled-cinematic' },
        ],
        folder: 'Aesthetics & Viewport',
      },
      { key: 'cameraAutoRotate', label: 'Auto Rotate Viewport', type: 'boolean', folder: 'Aesthetics & Viewport' },
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', min: 0.05, max: 2.0, step: 0.05, folder: 'Aesthetics & Viewport' },

      { key: 'pointerImpulse', label: 'Cursor Disturbance', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: 'Pointer Dynamics' },
      { key: 'shockwavePower', label: 'Click Shockwave Power', type: 'slider', min: 0.0, max: 5.0, step: 0.1, folder: 'Pointer Dynamics' },
      { key: 'sandDropRate', label: 'Sand Cluster Drop Rate', type: 'slider', min: 50, max: 800, step: 50, folder: 'Pointer Dynamics' },

      {
        key: 'audioSource',
        label: 'Audio Reactivity',
        type: 'select',
        options: [
          { label: 'Ambient Drone Synth', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Disabled / Muted', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Spectral Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'bassReaction', label: 'Bass Reaction (Modes)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'trebleReaction', label: 'Treble Reaction (Harmonics)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
    ],
  },

  // Room 21
  {
    id: 'moire',
    index: 21,
    indexDisplay: '#21',
    name: 'Moiré Interference Patterns',
    category: 'psychedelic',
    categoryName: 'Psychedelic & Optical',
    backend: 'tsl-shader',
    backendDisplay: 'THREE.JS / TSL',
    mathModel: 'Overlapping Rotational Geometric Gratings & Prismatic Optical Dispersion',
    description: 'Kinetic optical moiré beat fringes, rotational grating superpositions, and prismatic chromatic shimmer.',
    curatorialNote: 'Superimposes high-density linear Ronchi rulings, Fresnel zone plates, radial spokes, logarithmic spirals, and hexagonal dot lattices to reveal macroscopic phantom interference contours.',
    tags: ['moire', 'interference', 'gratings', 'ronchi', 'optical-illusion', 'fresnel', 'spirals', 'chromatic-dispersion', 'tsl', 'shader'],
    moods: ['optical', 'hypnotic', 'kinetic', 'op-art', 'prismatic', 'geometric'],
    defaultParams: {
      seed: '#00F0FF',
      preset: 'rotational-rings',
      gratingType: 'rings',
      waveform: 'cosine',
      layerCount: 2,
      density: 38.0,
      sharpness: 1.2,
      rotationSpeed1: 0.12,
      rotationSpeed2: -0.15,
      rotationSpeed3: 0.25,
      rotationSpeed4: -0.35,
      angleOffset: 0.08,
      scaleRatio: 1.0,
      centerDistance: 0.05,
      blendMode: 'multiplication',
      spiralArms: 6,
      spokeCount: 36,
      pointerInfluence: 1.2,
      pointerInertia: 12.0,
      chromaticMode: false,
      chromaticDispersion: 0.05,
      colorPalette: 'monochrome-op-art',
      contrast: 1.3,
      brightness: 0.0,
      audioSource: 'synth',
      audioSensitivity: 1.0,
      bassReaction: 1.2,
      midReaction: 1.0,
      trebleReaction: 1.4,
    },
    controls: [
      {
        key: 'preset',
        label: 'Optical Preset',
        type: 'select',
        options: [
          { label: 'Rotational Rings (Hyperbolic Beat)', value: 'rotational-rings' },
          { label: 'Counter Spokes (Starburst Gears)', value: 'counter-spokes' },
          { label: 'Cross Rulings (Macroscopic Beat)', value: 'cross-rulings' },
          { label: 'Spiral Vortex (Kaleidoscopic)', value: 'spiral-vortex' },
          { label: 'Fresnel Zone Beat (Linear Fringe)', value: 'fresnel-zone-beat' },
          { label: 'Chromatic Shimmer (Prismatic)', value: 'chromatic-shimmer' },
          { label: 'Hexagonal Lattice (Honeycomb)', value: 'hexagonal-lattice' },
        ],
        folder: 'Grating Geometry & Waveform',
      },
      {
        key: 'gratingType',
        label: 'Grating Geometry',
        type: 'select',
        options: [
          { label: 'Concentric Rings (Circular Zones)', value: 'rings' },
          { label: 'Parallel Rulings (Linear Ronchi)', value: 'linear' },
          { label: 'Radial Spokes (Star Wheel)', value: 'spokes' },
          { label: 'Logarithmic Spirals (Vortex)', value: 'spirals' },
          { label: 'Fresnel Zone Plates (Quadratic)', value: 'fresnel' },
          { label: 'Hexagonal Lattice (3-Plane Wave)', value: 'hex' },
        ],
        folder: 'Grating Geometry & Waveform',
      },
      {
        key: 'waveform',
        label: 'Waveform Profile',
        type: 'select',
        options: [
          { label: 'Cosine (Smooth Sinusoidal)', value: 'cosine' },
          { label: 'Ronchi Bar (Antialiased Square)', value: 'ronchi' },
          { label: 'Triangle Wave (Linear Ramp)', value: 'triangle' },
          { label: 'Sinusoidal Power (Narrow Bar)', value: 'sinusoidal-power' },
        ],
        folder: 'Grating Geometry & Waveform',
      },
      { key: 'layerCount', label: 'Active Layers', type: 'slider', min: 2, max: 4, step: 1, folder: 'Grating Geometry & Waveform' },
      { key: 'density', label: 'Spatial Density (k)', type: 'slider', min: 5.0, max: 120.0, step: 1.0, folder: 'Grating Geometry & Waveform' },
      { key: 'sharpness', label: 'Edge Sharpness / Contrast', type: 'slider', min: 0.1, max: 3.0, step: 0.05, folder: 'Grating Geometry & Waveform' },
      { key: 'spiralArms', label: 'Spiral Arm Count', type: 'slider', min: 1, max: 24, step: 1, folder: 'Grating Geometry & Waveform' },
      { key: 'spokeCount', label: 'Radial Spoke Count', type: 'slider', min: 8, max: 120, step: 2, folder: 'Grating Geometry & Waveform' },

      { key: 'rotationSpeed1', label: 'Layer 1 Velocity (ω₁)', type: 'slider', min: -3.0, max: 3.0, step: 0.02, folder: 'Rotational Dynamics & Layers' },
      { key: 'rotationSpeed2', label: 'Layer 2 Velocity (ω₂)', type: 'slider', min: -3.0, max: 3.0, step: 0.02, folder: 'Rotational Dynamics & Layers' },
      { key: 'rotationSpeed3', label: 'Layer 3 Velocity (ω₃)', type: 'slider', min: -3.0, max: 3.0, step: 0.02, folder: 'Rotational Dynamics & Layers' },
      { key: 'rotationSpeed4', label: 'Layer 4 Velocity (ω₄)', type: 'slider', min: -3.0, max: 3.0, step: 0.02, folder: 'Rotational Dynamics & Layers' },
      { key: 'angleOffset', label: 'Angular Layer Step (Δθ)', type: 'slider', min: 0.0, max: 3.14, step: 0.01, folder: 'Rotational Dynamics & Layers' },
      { key: 'scaleRatio', label: 'Layer Scale Ratio (sᵢ)', type: 'slider', min: 0.8, max: 1.5, step: 0.01, folder: 'Rotational Dynamics & Layers' },
      { key: 'centerDistance', label: 'Center Displacement (cᵢ)', type: 'slider', min: 0.0, max: 0.4, step: 0.01, folder: 'Rotational Dynamics & Layers' },
      {
        key: 'blendMode',
        label: 'Layer Blend Mode',
        type: 'select',
        options: [
          { label: 'Multiplication (Physical Overlay)', value: 'multiplication' },
          { label: 'Addition (Superposition)', value: 'addition' },
          { label: 'Difference (Contours)', value: 'difference' },
          { label: 'XOR (Interference)', value: 'xor' },
          { label: 'Min (Transmission Cut)', value: 'min' },
          { label: 'Max (Highlight Union)', value: 'max' },
        ],
        folder: 'Rotational Dynamics & Layers',
      },

      { key: 'pointerInfluence', label: 'Cursor Focal Shift', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Pointer Dynamics' },
      { key: 'pointerInertia', label: 'Spring Inertia Rate', type: 'slider', min: 2.0, max: 25.0, step: 1.0, folder: 'Pointer Dynamics' },

      { key: 'chromaticMode', label: 'Chromatic Dispersion', type: 'boolean', folder: 'Color & Spectral Dispersion' },
      { key: 'chromaticDispersion', label: 'Dispersion Delta (Δλ)', type: 'slider', min: 0.0, max: 0.25, step: 0.005, folder: 'Color & Spectral Dispersion' },
      {
        key: 'colorPalette',
        label: 'Curatorial Palette',
        type: 'select',
        options: [
          { label: 'Monochrome Op-Art', value: 'monochrome-op-art' },
          { label: 'Monochrome Inverted', value: 'monochrome-inverted' },
          { label: 'Spectral Dispersion (Rainbow)', value: 'spectral-dispersion' },
          { label: 'Obsidian Gold', value: 'obsidian-gold' },
          { label: 'Cyber Neon', value: 'cyber-neon' },
          { label: 'Solar Plasma', value: 'solar-plasma' },
          { label: 'Bioluminescent Cyan', value: 'bioluminescent-cyan' },
        ],
        folder: 'Color & Spectral Dispersion',
      },
      { key: 'contrast', label: 'Visual Contrast', type: 'slider', min: 0.5, max: 3.0, step: 0.1, folder: 'Color & Spectral Dispersion' },
      { key: 'brightness', label: 'Exposure Bias', type: 'slider', min: -0.5, max: 0.5, step: 0.02, folder: 'Color & Spectral Dispersion' },

      {
        key: 'audioSource',
        label: 'Audio Reactivity',
        type: 'select',
        options: [
          { label: 'Ambient Drone Synth', value: 'synth' },
          { label: 'Live Microphone', value: 'mic' },
          { label: 'Disabled / Muted', value: 'none' },
        ],
        folder: 'Audio Reactivity',
      },
      { key: 'audioSensitivity', label: 'Spectral Sensitivity', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'bassReaction', label: 'Bass Reaction (Pulsation)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'midReaction', label: 'Mid Reaction (Rotation)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
      { key: 'trebleReaction', label: 'Treble Reaction (Shimmer)', type: 'slider', min: 0.0, max: 3.0, step: 0.1, folder: 'Audio Reactivity' },
    ],
  },
];

// Map lookup table for O(1) room queries
const ROOM_MAP = new Map<string, RoomMetadata>(ROOM_CATALOG.map(room => [room.id, room]));

// In-memory module cache for instantiated rooms
const roomInstanceCache = new Map<string, RoomInstance>();

/**
 * Returns complete list of all generative rooms in order.
 */
export function getAllRooms(): readonly RoomMetadata[] {
  return ROOM_CATALOG;
}

/**
 * Looks up room metadata by its unique kebab-case ID (e.g. 'physarum').
 */
export function getRoomById(id: string): RoomMetadata | undefined {
  return ROOM_MAP.get(id);
}

/**
 * Filters rooms by curatorial category.
 */
export function filterRoomsByCategory(category: RoomCategory | 'all'): RoomMetadata[] {
  if (!category || category === 'all') {
    return [...ROOM_CATALOG];
  }
  return ROOM_CATALOG.filter(room => room.category === category);
}

/**
 * Real-time fuzzy query search matching across titles, mathematical algorithms,
 * compute technologies, and curatorial mood tags.
 */
export function searchRooms(query: string, category: RoomCategory | 'all' = 'all'): RoomMetadata[] {
  const baseList = filterRoomsByCategory(category);
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return baseList;
  }

  const terms = trimmed.split(/\s+/).filter(Boolean);

  return baseList.filter(room => {
    const searchableText = [
      room.id,
      room.name,
      room.indexDisplay,
      room.categoryName,
      room.backendDisplay,
      room.mathModel,
      room.description,
      ...(room.tags || []),
      ...(room.moods || []),
    ]
      .join(' ')
      .toLowerCase();

    return terms.every(term => searchableText.includes(term));
  });
}

/**
 * Returns distinct curatorial category list with exhibit counts.
 */
export function getCategories(): { id: RoomCategory | 'all'; name: string; count: number }[] {
  const categories: { id: RoomCategory | 'all'; name: string }[] = [
    { id: 'all', name: 'All Exhibits' },
    { id: 'field-flow', name: 'Field & Flow' },
    { id: 'art-life', name: 'Artificial Life' },
    { id: 'chaos', name: 'Chaos & Procedural' },
    { id: 'fluid', name: 'Fluid & Surface' },
    { id: 'cosmic', name: 'Cosmic' },
    { id: 'audio', name: 'Audio Reactive' },
    { id: 'psychedelic', name: 'Psychedelic & Optical' },
    { id: 'morphogenesis', name: 'Morphogenesis & Landscape' },
  ];

  return categories.map(cat => ({
    ...cat,
    count: cat.id === 'all' ? ROOM_CATALOG.length : ROOM_CATALOG.filter(r => r.category === cat.id).length,
  }));
}

/**
 * Dynamically loads and instantiates a room module asynchronously.
 * Falls back to a high-fidelity interactive mock simulation if the custom room module
 * has not yet been implemented in the active phase.
 */
export async function lazyLoadRoom(id: string): Promise<RoomInstance> {
  const cached = roomInstanceCache.get(id);
  if (cached) {
    return cached;
  }

  const metadata = getRoomById(id);
  if (!metadata) {
    throw new Error(`Room with ID "${id}" is not registered in the catalog.`);
  }

  try {
    // Dynamic import resolvers mapped by room ID
    let modulePromise: Promise<any>;

    switch (id) {
      case 'flow-field':
        modulePromise = import('./flow-field/index');
        break;
      case 'domain-warp':
        modulePromise = import('./domain-warp/index');
        break;
      case 'boids':
        modulePromise = import('./boids/index');
        break;
      case 'physarum':
        modulePromise = import('./physarum/index');
        break;
      case 'particle-life':
        modulePromise = import('./particle-life/index');
        break;
      case 'reaction-diffusion':
        modulePromise = import('./reaction-diffusion/index');
        break;
      case 'lenia':
        modulePromise = import('./lenia/index');
        break;
      case 'differential-growth':
        modulePromise = import('./differential-growth/index');
        break;
      case 'cyclic-automata':
        modulePromise = import('./cyclic-automata/index');
        break;
      case 'strange-attractors':
        modulePromise = import('./strange-attractors/index');
        break;
      case 'fractal':
        modulePromise = import('./fractal/index');
        break;
      case 'wave-function-collapse':
        modulePromise = import('./wave-function-collapse/index');
        break;
      case 'fluid':
        modulePromise = import('./fluid/index');
        break;
      case 'metaballs':
        modulePromise = import('./metaballs/index');
        break;
      case 'galaxy':
        modulePromise = import('./galaxy/index');
        break;
      case 'kaleidoscope':
        modulePromise = import('./kaleidoscope/index');
        break;
      case 'fractal-flames':
        modulePromise = import('./fractal-flames/index');
        break;
      case 'video-feedback':
        modulePromise = import('./video-feedback/index');
        break;
      case 'plasma':
        modulePromise = import('./plasma/index');
        break;
      case 'cymatics':
        modulePromise = import('./cymatics/index');
        break;
      case 'moire':
        modulePromise = import('./moire/index');
        break;
      default:
        modulePromise = Promise.reject(new Error(`Unmapped room ID: ${id}`));
    }

    const mod = await modulePromise;
    const instance = mod.default || mod.room || (typeof mod.createRoom === 'function' ? mod.createRoom() : null);

    if (instance && typeof instance.mount === 'function') {
      roomInstanceCache.set(id, instance);
      return instance;
    }

    throw new Error(`Room module "${id}" did not export a valid RoomInstance.`);
  } catch {
    // Graceful fallback to interactive mock room for testing
    const fallbackColor =
      metadata.category === 'field-flow'
        ? '#00F0FF'
        : metadata.category === 'art-life'
        ? '#00FF9D'
        : metadata.category === 'chaos'
        ? '#FFB800'
        : metadata.category === 'fluid'
        ? '#38BDF8'
        : metadata.category === 'cosmic'
        ? '#C084FC'
        : metadata.category === 'audio'
        ? '#FF3366'
        : metadata.category === 'psychedelic'
        ? '#FF2A6D'
        : '#05D69E';

    const fallbackInstance = createMockRoom(metadata.name, fallbackColor);
    roomInstanceCache.set(id, fallbackInstance);
    return fallbackInstance;
  }
}
