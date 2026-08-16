import './styles/main.css';

const app = document.getElementById('app');

if (app) {
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: var(--space-6); text-align: center;">
      <h1 style="font-family: var(--font-display); font-size: var(--text-heading-1); margin-bottom: var(--space-4); letter-spacing: var(--tracking-tight-lg);">
        ✦ AURORA
      </h1>
      <p style="font-family: var(--font-sans); font-size: var(--text-body-lg); color: var(--text-secondary); max-width: 540px; margin-bottom: var(--space-6);">
        Generative Art &amp; WebGPU Observatory
      </p>
      <div style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-full); font-family: var(--font-mono); font-size: var(--text-mono-badge); color: var(--accent-cyan); letter-spacing: var(--tracking-badge);">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent-mint);"></span>
        OBSIDIAN ARCHIVAL MINIMAL • V0.1.0 READY
      </div>
    </div>
  `;
}
