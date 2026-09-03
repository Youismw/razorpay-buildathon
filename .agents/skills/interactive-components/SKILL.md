---
name: interactive-components
description: >-
  Reference patterns for building interactive, stateful UI components — modals,
  command palettes, real-time data feeds, drag-and-drop, keyboard shortcuts,
  toast systems, and advanced table interactions. Use when building interactive
  features beyond static layouts.
---

# Interactive Component Patterns

This skill covers **interactive behavior** — the stuff that makes a UI feel alive and
production-grade. Use alongside the `production-ui` skill for visual design tokens.

---

## 1. Command Palette (⌘K / Ctrl+K)

Every serious app has a command palette. It's the fastest way to navigate.

```html
<dialog id="command-palette" class="command-palette">
  <div class="cp-backdrop"></div>
  <div class="cp-container">
    <div class="cp-search">
      <svg class="cp-icon"><!-- search icon --></svg>
      <input type="text" placeholder="Search commands..." autofocus />
      <kbd>ESC</kbd>
    </div>
    <div class="cp-results">
      <div class="cp-group">
        <span class="cp-group-label">Navigation</span>
        <button class="cp-item cp-item--active">
          <span>Go to Mandates</span>
          <kbd>⌘M</kbd>
        </button>
        <button class="cp-item">
          <span>Go to Ledger</span>
          <kbd>⌘L</kbd>
        </button>
      </div>
      <div class="cp-group">
        <span class="cp-group-label">Actions</span>
        <button class="cp-item">
          <span>Create New Mandate</span>
        </button>
      </div>
    </div>
  </div>
</dialog>
```

```css
.command-palette {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
}

.cp-container {
  width: 560px;
  max-height: 420px;
  background: var(--bg-secondary);
  border: var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: cpSlideDown 150ms var(--ease-out);
}

@keyframes cpSlideDown {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.cp-search {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: var(--border-subtle);
}

.cp-search input {
  flex: 1;
  border: none;
  outline: none;
  font-size: var(--text-base);
  background: transparent;
}

.cp-search kbd {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: 2px 6px;
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--neutral-400);
}

.cp-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--text-sm);
  text-align: left;
  border-radius: var(--radius-sm);
  margin: 1px var(--space-2);
}

.cp-item:hover, .cp-item--active {
  background: var(--neutral-100);
}

.cp-group-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--neutral-400);
  padding: var(--space-3) var(--space-4) var(--space-1);
}
```

```javascript
// Keyboard shortcut to open
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('command-palette').showModal();
  }
});
```

---

## 2. Toast Notification System

```javascript
class ToastManager {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${this.getIcon(type)}</div>
      <div class="toast-content">
        <p class="toast-message">${message}</p>
      </div>
      <button class="toast-close" aria-label="Dismiss">×</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    // Close on click
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => this.dismiss(toast), duration);
  }

  dismiss(toast) {
    toast.classList.add('toast--exiting');
    toast.addEventListener('animationend', () => toast.remove());
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };
    return icons[type] || icons.info;
  }
}

// Usage:
// const toast = new ToastManager();
// toast.show('Mandate created successfully', 'success');
// toast.show('Payment failed: insufficient balance', 'error');
```

```css
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  animation: toastSlideIn 300ms var(--ease-out) both;
  position: relative;
  overflow: hidden;
}

@keyframes toastSlideIn {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}

.toast--exiting {
  animation: toastSlideOut 200ms ease-in forwards;
}

@keyframes toastSlideOut {
  to { opacity: 0; transform: translateX(100%); }
}

/* Progress bar at bottom */
.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--primary);
  animation: progress linear forwards;
  width: 100%;
}

@keyframes progress {
  from { width: 100%; }
  to   { width: 0%; }
}

/* Type-specific left border accents */
.toast--success { border-left: 3px solid var(--success); }
.toast--error   { border-left: 3px solid var(--error); }
.toast--warning { border-left: 3px solid var(--warning); }
.toast--info    { border-left: 3px solid var(--info); }
```

---

## 3. Real-Time Data Feed (WebSocket / SSE Pattern)

For live audit logs, transaction streams, and status updates:

```javascript
class LiveFeed {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.maxItems = options.maxItems || 100;
    this.items = [];
  }

  addEntry(entry) {
    const el = document.createElement('div');
    el.className = 'feed-entry feed-entry--new';
    el.innerHTML = `
      <span class="feed-time">${this.formatTime(entry.timestamp)}</span>
      <span class="feed-module feed-module--${entry.module}">${entry.module}</span>
      <span class="feed-event">${entry.event}</span>
      <span class="feed-detail">${entry.detail || ''}</span>
    `;

    // Prepend (newest first)
    this.container.prepend(el);
    this.items.unshift(el);

    // Remove "new" animation class after animation completes
    requestAnimationFrame(() => {
      el.addEventListener('animationend', () => {
        el.classList.remove('feed-entry--new');
      });
    });

    // Prune old entries
    while (this.items.length > this.maxItems) {
      const old = this.items.pop();
      old.remove();
    }
  }

  formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }
}
```

```css
.feed-entry {
  display: grid;
  grid-template-columns: 100px 90px 160px 1fr;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  border-bottom: 1px solid var(--dark-border);
  line-height: 1.6;
}

.feed-entry--new {
  animation: feedHighlight 1.5s ease-out;
}

@keyframes feedHighlight {
  0%  { background: hsla(230, 70%, 50%, 0.15); }
  100% { background: transparent; }
}

.feed-time   { color: var(--neutral-400); }
.feed-event  { color: rgba(255, 255, 255, 0.87); }
.feed-detail { color: rgba(255, 255, 255, 0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Module-specific color coding */
.feed-module--compiler  { color: hsl(280, 60%, 65%); }
.feed-module--guardrail { color: hsl(38, 85%, 60%); }
.feed-module--vault     { color: hsl(152, 55%, 55%); }
.feed-module--adapter   { color: hsl(210, 65%, 60%); }
.feed-module--ledger    { color: hsl(340, 65%, 60%); }
```

---

## 4. Modal / Dialog System

```javascript
class Modal {
  constructor() {
    this.activeModal = null;
  }

  open(contentHTML, options = {}) {
    const dialog = document.createElement('dialog');
    dialog.className = `modal ${options.size || 'modal--md'}`;
    dialog.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-panel">
        ${options.title ? `
          <div class="modal-header">
            <h2 class="modal-title">${options.title}</h2>
            <button class="modal-close btn-ghost" aria-label="Close">
              <svg width="20" height="20"><use href="#icon-x"/></svg>
            </button>
          </div>
        ` : ''}
        <div class="modal-body">${contentHTML}</div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>
    `;

    // Close handlers
    dialog.querySelector('.modal-close')?.addEventListener('click', () => this.close(dialog));
    dialog.querySelector('.modal-overlay').addEventListener('click', () => this.close(dialog));
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close(dialog);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    this.activeModal = dialog;

    // Trap focus
    dialog.querySelector('.modal-panel').focus();
  }

  close(dialog) {
    dialog.classList.add('modal--closing');
    dialog.addEventListener('animationend', () => {
      dialog.close();
      dialog.remove();
    });
  }
}
```

```css
.modal {
  padding: 0;
  border: none;
  background: transparent;
  max-width: none;
  max-height: none;
  width: 100vw;
  height: 100vh;
}

.modal::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  animation: modalIn 200ms var(--ease-out);
  outline: none;
}

.modal--md .modal-panel { width: 520px; }
.modal--lg .modal-panel { width: 720px; }
.modal--xl .modal-panel { width: 960px; }

@keyframes modalIn {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.modal--closing .modal-panel {
  animation: modalOut 150ms ease-in forwards;
}

@keyframes modalOut {
  to { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  border-bottom: var(--border-subtle);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-subtle);
}
```

---

## 5. Advanced Table Features

### 5.1 Sortable Columns

```javascript
function makeSortable(table) {
  const headers = table.querySelectorAll('th[data-sort]');
  let currentSort = { column: null, direction: 'asc' };

  headers.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      const direction = currentSort.column === column && currentSort.direction === 'asc'
        ? 'desc' : 'asc';

      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const index = Array.from(th.parentElement.children).indexOf(th);

      rows.sort((a, b) => {
        const aVal = a.children[index].textContent.trim();
        const bVal = b.children[index].textContent.trim();
        const compare = aVal.localeCompare(bVal, undefined, { numeric: true });
        return direction === 'asc' ? compare : -compare;
      });

      rows.forEach(row => tbody.appendChild(row));

      // Update visual indicators
      headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(`sort-${direction}`);
      currentSort = { column, direction };
    });
  });
}
```

### 5.2 Inline Row Expansion

```javascript
function makeExpandable(table) {
  table.querySelectorAll('tr[data-expandable]').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const detailRow = row.nextElementSibling;
      if (detailRow?.classList.contains('row-detail')) {
        const isOpen = detailRow.classList.toggle('row-detail--open');
        row.classList.toggle('row--expanded', isOpen);
      }
    });
  });
}
```

```css
.row-detail {
  display: none;
}

.row-detail--open {
  display: table-row;
}

.row-detail td {
  padding: 0;
}

.row-detail-content {
  padding: var(--space-4) var(--space-6);
  background: var(--neutral-50);
  border-left: 3px solid var(--primary);
  animation: expandIn 200ms var(--ease-out);
}

@keyframes expandIn {
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 500px; }
}

/* Sort indicators */
th[data-sort]::after {
  content: '⇅';
  margin-left: var(--space-1);
  opacity: 0.3;
  font-size: 0.8em;
}

th.sort-asc::after  { content: '↑'; opacity: 1; }
th.sort-desc::after { content: '↓'; opacity: 1; }
```

---

## 6. Keyboard Shortcut System

```javascript
class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  register(combo, callback, description) {
    this.shortcuts.set(combo, { callback, description });
  }

  handleKeydown(e) {
    // Don't trigger when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('mod');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());

    const combo = parts.join('+');
    const shortcut = this.shortcuts.get(combo);

    if (shortcut) {
      e.preventDefault();
      shortcut.callback();
    }
  }

  getAll() {
    return Array.from(this.shortcuts.entries()).map(([combo, { description }]) => ({
      combo, description,
    }));
  }
}

// Usage:
// const keys = new KeyboardShortcuts();
// keys.register('mod+k', () => openCommandPalette(), 'Open command palette');
// keys.register('mod+m', () => navigateTo('/mandates'), 'Go to mandates');
// keys.register('?', () => showShortcutHelp(keys), 'Show keyboard shortcuts');
```

---

## 7. Confidence/Progress Visualization

For the guardrail confidence scores:

```css
.confidence-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.confidence-track {
  flex: 1;
  height: 8px;
  background: var(--neutral-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 600ms var(--ease-out);
}

/* Color thresholds */
.confidence-fill[data-value="high"]   { background: var(--success); }
.confidence-fill[data-value="medium"] { background: var(--warning); }
.confidence-fill[data-value="low"]    { background: var(--error); }

.confidence-label {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  min-width: 48px;
  text-align: right;
}
```

```javascript
function renderConfidence(container, score) {
  const percentage = Math.round(score * 100);
  const level = score >= 0.85 ? 'high' : score >= 0.60 ? 'medium' : 'low';

  container.innerHTML = `
    <div class="confidence-bar">
      <div class="confidence-track">
        <div class="confidence-fill" data-value="${level}"
             style="width: ${percentage}%"></div>
      </div>
      <span class="confidence-label">${percentage}%</span>
    </div>
  `;
}
```

---

## 8. Form Patterns

### 8.1 Inline Validation

```css
.form-field {
  margin-bottom: var(--space-5);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--neutral-700);
  margin-bottom: var(--space-1);
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: var(--border-default);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  transition: border-color 150ms ease, box-shadow 150ms ease;
  outline: none;
}

.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px hsla(230, 72%, 50%, 0.15);
}

.form-input--error {
  border-color: var(--error);
}

.form-input--error:focus {
  box-shadow: 0 0 0 3px hsla(4, 70%, 55%, 0.15);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--neutral-400);
  margin-top: var(--space-1);
}

.form-error {
  font-size: var(--text-xs);
  color: var(--error);
  margin-top: var(--space-1);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
```

### 8.2 Amount Input (INR)

```javascript
function createAmountInput(input) {
  input.addEventListener('input', (e) => {
    // Strip non-numeric except decimal
    let value = e.target.value.replace(/[^0-9.]/g, '');

    // Format as INR
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Show formatted on blur, raw on focus
        input.dataset.rawValue = value;
      }
    }
  });

  input.addEventListener('blur', (e) => {
    const raw = parseFloat(e.target.dataset.rawValue);
    if (!isNaN(raw)) {
      e.target.value = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(raw);
    }
  });

  input.addEventListener('focus', (e) => {
    e.target.value = e.target.dataset.rawValue || '';
  });
}
```

---

## 9. Reference: Sites That Do It Right

Study these for inspiration (NOT to copy, but to absorb the craft):

| Site | What to Learn |
|---|---|
| [Linear](https://linear.app) | Keyboard-first UX, command palette, transitions |
| [Vercel Dashboard](https://vercel.com/dashboard) | Clean data presentation, dark mode, status displays |
| [Stripe Dashboard](https://dashboard.stripe.com) | Fintech table design, payment status flows, dense data |
| [Raycast](https://raycast.com) | Command palette UX, animations, component polish |
| [Figma](https://figma.com) | Canvas interactions, contextual menus, real-time collaboration |
| [Razorpay Dashboard](https://dashboard.razorpay.com) | Payment-specific patterns, Indian fintech conventions |

**Key takeaway:** All of these sites share: restrained color, excellent typography,
keyboard accessibility, and **information density without visual clutter**.
