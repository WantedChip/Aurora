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
    tags: ['differential-growth', 'curve', 'meandering', 'subdivision', 'relaxation', 'flora'],
    moods: ['organic', 'geometric', 'calm', 'intricate'],
    defaultParams: {
      seed: '#FF8A00',
      maxNodes: 4000,
      repulsionRadius: 18.0,
      attractionStrength: 0.3,
      splitThreshold: 14.0,
    },
    controls: [
      { key: 'maxNodes', label: 'Max Nodes', type: 'slider', min: 500, max: 8000, step: 250, folder: 'Growth Constraints' },
      { key: 'repulsionRadius', label: 'Repulsion Radius', type: 'slider', min: 8.0, max: 32.0, step: 1.0, folder: 'Spring Forces' },
      { key: 'attractionStrength', label: 'Cohesion Tension', type: 'slider', min: 0.05, max: 0.8, step: 0.05, folder: 'Spring Forces' },
      { key: 'splitThreshold', label: 'Split Distance', type: 'slider', min: 6.0, max: 24.0, step: 1.0, folder: 'Growth Constraints' },
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
      stateCount: 16,
      threshold: 3,
      neighborhoodRange: 2,
      simSpeed: 2,
    },
    controls: [
      { key: 'stateCount', label: 'Color States (N)', type: 'slider', min: 4, max: 32, step: 1, folder: 'Rules' },
      { key: 'threshold', label: 'Advance Threshold (K)', type: 'slider', min: 1, max: 6, step: 1, folder: 'Rules' },
      { key: 'neighborhoodRange', label: 'Neighborhood Range', type: 'slider', min: 1, max: 4, step: 1, folder: 'Rules' },
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
    backendDisplay: 'WEBGL2',
    mathModel: 'Lorenz, Clifford & Aizawa Differential Orbits',
    description: 'Millions of 3D point orbits navigating non-linear chaotic attractor manifolds with fractal dimension.',
    curatorialNote: 'Visualizes the sensitive dependence on initial conditions that characterizes the butterfly effect in chaotic dynamical systems.',
    tags: ['chaos', 'attractor', 'lorenz', 'clifford', 'aizawa', 'point-cloud', 'fractal-dimension'],
    moods: ['cosmic', 'mathematical', 'hypnotic', 'delicate'],
    defaultParams: {
      seed: '#00F0FF',
      attractorType: 'lorenz',
      particleCount: 200000,
      dt: 0.005,
      rotationSpeed: 0.4,
      pointSize: 1.5,
    },
    controls: [
      {
        key: 'attractorType',
        label: 'Attractor System',
        type: 'select',
        options: [
          { label: 'Lorenz Attractor', value: 'lorenz' },
          { label: 'Aizawa Attractor', value: 'aizawa' },
          { label: 'Clifford Attractor', value: 'clifford' },
          { label: 'Thomas Cyclical', value: 'thomas' },
        ],
        folder: 'Dynamical System',
      },
      { key: 'particleCount', label: 'Point Count', type: 'slider', min: 50000, max: 500000, step: 25000, folder: 'Rendering' },
      { key: 'dt', label: 'Integration Step', type: 'slider', min: 0.001, max: 0.015, step: 0.001, folder: 'Physics' },
      { key: 'rotationSpeed', label: 'Orbit Rotation', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Camera' },
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
    mathModel: 'Distance Estimated Mandelbulb & Menger Sponge',
    description: 'Real-time raymarching through 3D Mandelbulb and Menger Sponge fractal distance estimation fields.',
    curatorialNote: 'Explores hyper-complex infinite structural details rendered via GPU sphere tracing and analytic surface normals.',
    tags: ['raymarching', 'sdf', 'mandelbulb', 'menger', 'fractal', '3d', 'shader'],
    moods: ['cosmic', 'hypnotic', 'infinite', 'monumental'],
    defaultParams: {
      seed: '#C084FC',
      fractalType: 'mandelbulb',
      power: 8.0,
      maxSteps: 80,
      glowIntensity: 1.2,
      camDistance: 2.5,
    },
    controls: [
      {
        key: 'fractalType',
        label: 'Fractal Topology',
        type: 'select',
        options: [
          { label: 'Mandelbulb (3D)', value: 'mandelbulb' },
          { label: 'Menger Sponge', value: 'menger' },
          { label: 'Julia Quaternion', value: 'julia' },
        ],
        folder: 'Topology',
      },
      { key: 'power', label: 'Order / Power', type: 'slider', min: 2.0, max: 14.0, step: 0.5, folder: 'Fractal Equation' },
      { key: 'glowIntensity', label: 'Atmospheric Glow', type: 'slider', min: 0.2, max: 3.0, step: 0.1, folder: 'Lighting' },
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
      symmetryEnforce: true,
    },
    controls: [
      { key: 'gridSize', label: 'Grid Resolution', type: 'slider', min: 16, max: 64, step: 4, folder: 'Lattice' },
      {
        key: 'tileSet',
        label: 'Tile Set',
        type: 'select',
        options: [
          { label: 'Cyber Circuit', value: 'circuit' },
          { label: 'Architectural Maze', value: 'maze' },
          { label: 'Minimal Pipes', value: 'pipes' },
        ],
        folder: 'Aesthetics',
      },
      { key: 'collapseSpeed', label: 'Collapse Steps / Frame', type: 'slider', min: 1, max: 20, step: 1, folder: 'Solver' },
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
    mathModel: 'Jos Stam Real-Time Navier-Stokes Solver',
    description: 'Incompressible Eulerian fluid grid simulating smoke advection, curl vorticity confinement, and pressure Poisson projection.',
    curatorialNote: 'Solves the continuous Navier-Stokes differential equations in real-time, responding fluidly to pointer velocity impulses.',
    tags: ['fluid', 'navier-stokes', 'smoke', 'vorticity', 'advection', 'dye', 'interactive'],
    moods: ['fluid', 'tactile', 'hypnotic', 'responsive'],
    defaultParams: {
      seed: '#38BDF8',
      viscosity: 0.001,
      vorticity: 15.0,
      dissipation: 0.985,
      splatRadius: 0.003,
      dyePalette: 'spectral',
    },
    controls: [
      { key: 'vorticity', label: 'Vorticity Confinement', type: 'slider', min: 0.0, max: 40.0, step: 1.0, folder: 'Fluid Physics' },
      { key: 'dissipation', label: 'Density Persistence', type: 'slider', min: 0.92, max: 0.999, step: 0.002, folder: 'Fluid Physics' },
      { key: 'splatRadius', label: 'Brush Radius', type: 'slider', min: 0.001, max: 0.01, step: 0.0005, folder: 'Interaction' },
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
      ballCount: 18,
      isolationThreshold: 0.65,
      roughness: 0.1,
      metalness: 0.9,
      clusterSpeed: 0.8,
    },
    controls: [
      { key: 'ballCount', label: 'Metaball Count', type: 'slider', min: 6, max: 40, step: 1, folder: 'Cluster' },
      { key: 'isolationThreshold', label: 'Surface Tension', type: 'slider', min: 0.3, max: 0.9, step: 0.05, folder: 'Marching Cubes' },
      { key: 'clusterSpeed', label: 'Orbit Dynamics', type: 'slider', min: 0.1, max: 2.5, step: 0.1, folder: 'Cluster' },
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
      starCount: 300000,
      spiralArms: 3,
      armWinding: 2.8,
      coreConcentration: 2.5,
      cameraSpeed: 0.3,
    },
    controls: [
      { key: 'starCount', label: 'Star Count', type: 'slider', min: 50000, max: 600000, step: 50000, folder: 'Galactic Structure' },
      { key: 'spiralArms', label: 'Spiral Arms', type: 'slider', min: 2, max: 6, step: 1, folder: 'Galactic Structure' },
      { key: 'armWinding', label: 'Arm Twist Angle', type: 'slider', min: 1.0, max: 6.0, step: 0.2, folder: 'Galactic Structure' },
      { key: 'coreConcentration', label: 'Core Density', type: 'slider', min: 1.0, max: 5.0, step: 0.2, folder: 'Astrophysics' },
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
      symmetrySegments: 8,
      audioSensitivity: 1.8,
      zoomSpeed: 0.4,
      colorCycleSpeed: 0.5,
      mirrorOffset: 0.2,
    },
    controls: [
      { key: 'symmetrySegments', label: 'Symmetry Fold (N)', type: 'slider', min: 3, max: 16, step: 1, folder: 'Optics' },
      { key: 'audioSensitivity', label: 'Audio Reactive Gain', type: 'slider', min: 0.2, max: 5.0, step: 0.1, folder: 'Audio Engine' },
      { key: 'zoomSpeed', label: 'Tunnel Zoom Rate', type: 'slider', min: 0.0, max: 2.0, step: 0.1, folder: 'Optics' },
      { key: 'colorCycleSpeed', label: 'Color Harmonic Shift', type: 'slider', min: 0.1, max: 2.0, step: 0.1, folder: 'Aesthetics' },
    ],
  },
];

// Map lookup table for O(1) room queries
const ROOM_MAP = new Map<string, RoomMetadata>(ROOM_CATALOG.map(room => [room.id, room]));

// In-memory module cache for instantiated rooms
const roomInstanceCache = new Map<string, RoomInstance>();

/**
 * Returns complete list of all 16 generative rooms in order.
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
        : '#FF3366';

    const fallbackInstance = createMockRoom(metadata.name, fallbackColor);
    roomInstanceCache.set(id, fallbackInstance);
    return fallbackInstance;
  }
}
