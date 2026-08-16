import './styles/main.css';
import { runLibVerification } from './verify-lib';

async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: var(--space-6); text-align: center;">
      <h1 style="font-family: var(--font-display); font-size: var(--text-heading-1); margin-bottom: var(--space-2); letter-spacing: var(--tracking-tight-lg);">
        ✦ AURORA
      </h1>
      <p style="font-family: var(--font-sans); font-size: var(--text-body-lg); color: var(--text-secondary); max-width: 540px; margin-bottom: var(--space-6);">
        Generative Art &amp; WebGPU Observatory — Core Infrastructure
      </p>
      
      <div id="verification-panel" style="width: 100%; max-width: 640px; text-align: left; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-card);">
        <div style="font-family: var(--font-mono); font-size: var(--text-mono-head); color: var(--text-muted); margin-bottom: var(--space-4); text-transform: uppercase; letter-spacing: var(--tracking-mono-wide);">
          Core Library Validation Suite (v0.1.1)
        </div>
        <div id="results-list" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="font-family: var(--font-mono); font-size: var(--text-caption); color: var(--text-secondary);">Executing capability tests...</div>
        </div>
      </div>
    </div>
  `;

  const results = await runLibVerification();
  const resultsContainer = document.getElementById('results-list');
  if (resultsContainer) {
    resultsContainer.innerHTML = results
      .map(
        r => `
        <div style="display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); background: var(--bg-surface-2); border-radius: var(--radius-md); border-left: 3px solid ${
          r.passed ? 'var(--accent-mint)' : 'var(--accent-crimson)'
        };">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-family: var(--font-mono); font-size: var(--text-mono-badge); color: ${
              r.passed ? 'var(--accent-mint)' : 'var(--accent-crimson)'
            }; font-weight: 600;">
              ${r.passed ? '✓ PASSED' : '✗ FAILED'} • ${r.module}
            </span>
          </div>
          <div style="font-family: var(--font-mono); font-size: var(--text-caption); color: var(--text-secondary);">
            ${r.details}
          </div>
        </div>
      `
      )
      .join('');
  }
}

bootstrap();
