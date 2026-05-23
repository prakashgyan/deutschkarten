import { initStorage, getDecks, saveDeck, deleteDeck, getCards, getCardsByDeck, saveCard, deleteCard, getStats, recordReview, generateId } from './storage.js';
import { sm2, isDue, getDueCount } from './srs.js';
import { parseApkg } from './importer.js';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  view: 'home',          // home | decks | deck | study | add-card | add-deck | edit-card | edit-deck
  activeDeckId: null,
  study: {
    queue: [],
    current: 0,
    flipped: false,
    sessionStats: { again: 0, hard: 0, good: 0, easy: 0 },
  },
  editingCard: null,
  editingDeck: null,
};

// ── Router ───────────────────────────────────────────────────────────────────
function navigate(view, params = {}) {
  state.view = view;
  Object.assign(state, params);
  render();
  window.scrollTo(0, 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const DECK_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777','#0284c7'];

function deckColor(deck) { return deck.color || DECK_COLORS[0]; }

function getDueCards(deckId) {
  const cards = deckId ? getCardsByDeck(deckId) : getCards();
  return cards.filter(isDue);
}

function totalDue() { return getDueCards(null).length; }

function fmt(n) { return n < 10 ? `0${n}` : `${n}`; }

function daysUntilDue(card) {
  if (!card.dueDate) return 0;
  const diff = Math.ceil((new Date(card.dueDate) - new Date()) / 86400000);
  return diff;
}

// ── Render dispatcher ────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  switch (state.view) {
    case 'home':     app.innerHTML = renderHome();     break;
    case 'decks':    app.innerHTML = renderDecks();    break;
    case 'deck':     app.innerHTML = renderDeck();     break;
    case 'study':    app.innerHTML = renderStudy();    break;
    case 'add-card': app.innerHTML = renderCardForm(); break;
    case 'add-deck': app.innerHTML = renderDeckForm(); break;
    case 'stats':    app.innerHTML = renderStats();    break;
  }
  attachHandlers();
}

// ── Views ─────────────────────────────────────────────────────────────────────

function renderNav(active) {
  const items = [
    { id: 'home',  icon: '🏠', label: 'Home' },
    { id: 'decks', icon: '📚', label: 'Decks' },
    { id: 'stats', icon: '📊', label: 'Stats' },
  ];
  return `
    <nav class="bottom-nav">
      ${items.map(i => `
        <button class="nav-btn ${active === i.id ? 'active' : ''}" data-nav="${i.id}">
          <span class="nav-icon">${i.icon}</span>
          <span class="nav-label">${i.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderHome() {
  const stats = getStats();
  const decks = getDecks();
  const due = totalDue();

  const deckCards = decks.map(deck => {
    const cards = getCardsByDeck(deck.id);
    const dueCount = getDueCards(deck.id).length;
    return `
      <div class="deck-card clickable" data-action="open-deck" data-deck="${deck.id}" style="--deck-color:${deckColor(deck)}">
        <div class="deck-card-header">
          <div class="deck-dot"></div>
          <span class="deck-name">${deck.name}</span>
        </div>
        <div class="deck-meta">
          <span>${cards.length} cards</span>
          ${dueCount > 0 ? `<span class="badge">${dueCount} due</span>` : '<span class="badge badge-ok">✓ up to date</span>'}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page page-home">
      <header class="app-header">
        <div class="header-logo">🇩🇪</div>
        <div>
          <h1 class="app-title">DeutschKarten</h1>
          <p class="app-subtitle">German Flashcards</p>
        </div>
      </header>

      <div class="stats-row">
        <div class="stat-pill">
          <span class="stat-num">${stats.streak}</span>
          <span class="stat-lbl">🔥 streak</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">${due}</span>
          <span class="stat-lbl">📋 due</span>
        </div>
        <div class="stat-pill">
          <span class="stat-num">${stats.todayReviews || 0}</span>
          <span class="stat-lbl">✅ today</span>
        </div>
      </div>

      ${due > 0 ? `
        <button class="btn btn-primary btn-study-all" data-action="study-all">
          Study all due cards (${due})
        </button>
      ` : `
        <div class="all-done">
          <div class="all-done-icon">🎉</div>
          <p>All caught up! Come back tomorrow.</p>
        </div>
      `}

      <h2 class="section-title">Your Decks</h2>
      <div class="deck-grid">${deckCards}</div>

      <button class="fab" data-action="add-deck" title="Add deck">+</button>
    </div>
    ${renderNav('home')}
  `;
}

function renderDecks() {
  const decks = getDecks();
  const rows = decks.map(deck => {
    const cards = getCardsByDeck(deck.id);
    const due = getDueCards(deck.id).length;
    return `
      <div class="list-item" style="--deck-color:${deckColor(deck)}">
        <div class="list-item-left" data-action="open-deck" data-deck="${deck.id}">
          <div class="list-dot"></div>
          <div>
            <div class="list-title">${deck.name}</div>
            <div class="list-sub">${cards.length} cards${due > 0 ? ` · ${due} due` : ''}</div>
          </div>
        </div>
        <div class="list-actions">
          ${due > 0 ? `<button class="btn btn-sm btn-primary" data-action="study-deck" data-deck="${deck.id}">Study</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="edit-deck" data-deck="${deck.id}">✏️</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-action="delete-deck" data-deck="${deck.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page">
      <div class="page-header">
        <h2 class="page-title">All Decks</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-ghost" data-action="import-apkg" title="Import .apkg">📥 Import</button>
          <button class="btn btn-primary btn-sm" data-action="add-deck">+ New Deck</button>
        </div>
      </div>
      <div class="list">${rows || '<p class="empty">No decks yet. Create one or import an .apkg!</p>'}</div>
      <input type="file" id="apkg-input" accept=".apkg" style="display:none">
    </div>
    ${renderNav('decks')}
    ${renderImportOverlay()}
  `;
}

function renderDeck() {
  const deck = getDecks().find(d => d.id === state.activeDeckId);
  if (!deck) { navigate('decks'); return ''; }

  const cards = getCardsByDeck(deck.id);
  const due = getDueCards(deck.id).length;

  const rows = cards.map(card => {
    const days = daysUntilDue(card);
    const dueLabel = !card.lastReviewed ? '<span class="badge">New</span>'
      : days <= 0 ? '<span class="badge">Due</span>'
      : `<span class="badge badge-ok">+${days}d</span>`;
    return `
      <div class="list-item">
        <div class="list-item-left">
          <div>
            <div class="list-title">${card.front}</div>
            <div class="list-sub">${card.back}</div>
          </div>
        </div>
        <div class="list-actions">
          ${dueLabel}
          <button class="btn btn-sm btn-ghost" data-action="edit-card" data-card="${card.id}">✏️</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-action="delete-card" data-card="${card.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-ghost btn-back" data-nav="decks">← Back</button>
        <h2 class="page-title" style="color:${deckColor(deck)}">${deck.name}</h2>
      </div>
      <div class="deck-info-bar">
        <span>${cards.length} cards</span>
        <span>${due} due</span>
        ${due > 0 ? `<button class="btn btn-primary btn-sm" data-action="study-deck" data-deck="${deck.id}">Study Now</button>` : ''}
        <button class="btn btn-sm" data-action="add-card" data-deck="${deck.id}">+ Add Card</button>
      </div>
      <div class="list">${rows || '<p class="empty">No cards yet.</p>'}</div>
    </div>
    ${renderNav('decks')}
  `;
}

function renderStudy() {
  const { queue, current, flipped, sessionStats } = state.study;
  if (current >= queue.length) {
    return renderStudyComplete();
  }

  const card = queue[current];
  const progress = Math.round((current / queue.length) * 100);
  const remaining = queue.length - current;

  return `
    <div class="page page-study">
      <div class="study-header">
        <button class="btn btn-ghost btn-back" data-action="end-study">✕ End</button>
        <div class="study-progress-wrap">
          <div class="study-progress-bar" style="width:${progress}%"></div>
        </div>
        <span class="study-count">${remaining} left</span>
      </div>

      <div class="study-body">
        <div class="flashcard ${flipped ? 'flipped' : ''}" data-action="flip-card">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <div class="card-label">German</div>
              <div class="card-word">${card.front}</div>
              ${card.hint ? `<div class="card-hint">${card.hint}</div>` : ''}
              <div class="tap-hint">Tap to reveal →</div>
            </div>
            <div class="flashcard-back">
              <div class="card-label">English</div>
              <div class="card-word">${card.back}</div>
              ${card.hint ? `<div class="card-hint">${card.hint}</div>` : ''}
              <div class="card-front-ref">${card.front}</div>
            </div>
          </div>
        </div>

        ${flipped ? `
          <div class="rating-row">
            <button class="rating-btn rating-again" data-action="rate" data-rating="0" data-key="1">
              <span class="rating-icon">😫</span>
              <span>Again</span>
              <span class="rating-time">&lt;1m</span>
            </button>
            <button class="rating-btn rating-hard" data-action="rate" data-rating="1" data-key="2">
              <span class="rating-icon">😓</span>
              <span>Hard</span>
              <span class="rating-time">~${Math.ceil((card.interval||1)*1.2)}d</span>
            </button>
            <button class="rating-btn rating-good" data-action="rate" data-rating="2" data-key="3">
              <span class="rating-icon">🙂</span>
              <span>Good</span>
              <span class="rating-time">~${card.repetitions===0?1:card.repetitions===1?6:Math.round((card.interval||1)*(card.easeFactor||2.5))}d</span>
            </button>
            <button class="rating-btn rating-easy" data-action="rate" data-rating="3" data-key="4">
              <span class="rating-icon">😄</span>
              <span>Easy</span>
              <span class="rating-time">~${card.repetitions===0?4:card.repetitions===1?10:Math.round((card.interval||1)*(card.easeFactor||2.5)*1.3)}d</span>
            </button>
          </div>
        ` : `
          <p class="study-prompt">How well do you know this word?<br><small>Tap the card to see the answer</small></p>
        `}
      </div>

      <div class="session-tally">
        <span class="tally again">${sessionStats.again} ×</span>
        <span class="tally hard">${sessionStats.hard} H</span>
        <span class="tally good">${sessionStats.good} G</span>
        <span class="tally easy">${sessionStats.easy} E</span>
      </div>
    </div>
  `;
}

function renderStudyComplete() {
  const { sessionStats } = state.study;
  const total = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;
  const score = total > 0 ? Math.round(((sessionStats.good + sessionStats.easy) / total) * 100) : 0;
  const emoji = score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪';

  return `
    <div class="page page-complete">
      <div class="complete-content">
        <div class="complete-emoji">${emoji}</div>
        <h2 class="complete-title">Session Complete!</h2>
        <p class="complete-score">${score}% recalled</p>
        <div class="complete-stats">
          <div class="cs-item cs-again"><span>${sessionStats.again}</span><small>Again</small></div>
          <div class="cs-item cs-hard"><span>${sessionStats.hard}</span><small>Hard</small></div>
          <div class="cs-item cs-good"><span>${sessionStats.good}</span><small>Good</small></div>
          <div class="cs-item cs-easy"><span>${sessionStats.easy}</span><small>Easy</small></div>
        </div>
        <div class="complete-actions">
          <button class="btn btn-primary" data-nav="home">Back to Home</button>
          <button class="btn" data-nav="decks">Browse Decks</button>
        </div>
      </div>
    </div>
  `;
}

function renderStats() {
  const stats = getStats();
  const decks = getDecks();
  const allCards = getCards();
  const reviewed = allCards.filter(c => c.lastReviewed);
  const newCards = allCards.filter(c => !c.lastReviewed);

  const deckRows = decks.map(deck => {
    const cards = getCardsByDeck(deck.id);
    const learnedCount = cards.filter(c => c.lastReviewed).length;
    const pct = cards.length > 0 ? Math.round((learnedCount / cards.length) * 100) : 0;
    return `
      <div class="stat-row" style="--deck-color:${deckColor(deck)}">
        <div class="stat-row-label">
          <div class="list-dot"></div>
          <span>${deck.name}</span>
        </div>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${pct}%"></div>
        </div>
        <span class="stat-pct">${pct}%</span>
      </div>
    `;
  }).join('');

  return `
    <div class="page">
      <div class="page-header"><h2 class="page-title">Statistics</h2></div>

      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-num">${stats.streak || 0}</div>
          <div class="stats-card-lbl">🔥 Day streak</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-num">${stats.totalReviews || 0}</div>
          <div class="stats-card-lbl">📝 Total reviews</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-num">${reviewed.length}</div>
          <div class="stats-card-lbl">✅ Reviewed cards</div>
        </div>
        <div class="stats-card">
          <div class="stats-card-num">${newCards.length}</div>
          <div class="stats-card-lbl">🆕 New cards</div>
        </div>
      </div>

      <h3 class="section-title">Progress by Deck</h3>
      <div class="stat-rows">${deckRows}</div>
    </div>
    ${renderNav('stats')}
  `;
}

function renderCardForm() {
  const isEdit = !!state.editingCard;
  const card = isEdit ? state.editingCard : { front: '', back: '', hint: '' };
  const decks = getDecks();
  const deckOptions = decks.map(d =>
    `<option value="${d.id}" ${(state.activeDeckId === d.id || card.deckId === d.id) ? 'selected' : ''}>${d.name}</option>`
  ).join('');

  return `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-ghost btn-back" data-action="back-from-form">← Back</button>
        <h2 class="page-title">${isEdit ? 'Edit Card' : 'New Card'}</h2>
      </div>
      <form class="card-form" id="card-form">
        <div class="form-group">
          <label class="form-label">Deck</label>
          <select class="form-input" name="deckId" required>${deckOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">German (Front)</label>
          <input class="form-input" name="front" type="text" placeholder="e.g. Hallo" value="${card.front}" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">English (Back)</label>
          <input class="form-input" name="back" type="text" placeholder="e.g. Hello" value="${card.back}" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Hint <small>(optional)</small></label>
          <input class="form-input" name="hint" type="text" placeholder="e.g. Informal greeting" value="${card.hint || ''}" autocomplete="off">
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Save Changes' : 'Add Card'}</button>
      </form>
    </div>
  `;
}

function renderDeckForm() {
  const isEdit = !!state.editingDeck;
  const deck = isEdit ? state.editingDeck : { name: '', description: '', color: DECK_COLORS[0] };

  const colorPickers = DECK_COLORS.map(c =>
    `<button type="button" class="color-swatch ${deck.color === c ? 'selected' : ''}" style="background:${c}" data-action="pick-color" data-color="${c}"></button>`
  ).join('');

  return `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-ghost btn-back" data-nav="decks">← Back</button>
        <h2 class="page-title">${isEdit ? 'Edit Deck' : 'New Deck'}</h2>
      </div>
      <form class="card-form" id="deck-form">
        <div class="form-group">
          <label class="form-label">Deck Name</label>
          <input class="form-input" name="name" type="text" placeholder="e.g. Travel German" value="${deck.name}" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Description <small>(optional)</small></label>
          <input class="form-input" name="description" type="text" placeholder="What's this deck about?" value="${deck.description || ''}" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-swatches" id="color-swatches">${colorPickers}</div>
          <input type="hidden" name="color" id="color-input" value="${deck.color}">
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Save Changes' : 'Create Deck'}</button>
      </form>
    </div>
  `;
}

// ── Import overlay ────────────────────────────────────────────────────────────
function renderImportOverlay() {
  return `
    <div class="import-overlay" id="import-overlay" style="display:none">
      <div class="import-modal">
        <div class="import-icon" id="import-icon">📥</div>
        <div class="import-title" id="import-title">Import .apkg</div>
        <div class="import-msg" id="import-msg">Loading…</div>
        <div class="import-progress"><div class="import-bar" id="import-bar"></div></div>
      </div>
    </div>
  `;
}

function showImportOverlay(msg, progress = 0, icon = '⏳') {
  const overlay = document.getElementById('import-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.getElementById('import-icon').textContent = icon;
  document.getElementById('import-msg').textContent = msg;
  document.getElementById('import-bar').style.width = `${progress}%`;
}

function hideImportOverlay() {
  const overlay = document.getElementById('import-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function handleApkgImport(file) {
  const steps = ['Loading libraries…','Reading file…','Extracting archive…','Opening database…','Parsing decks…','Importing cards…'];
  let step = 0;

  showImportOverlay(steps[0], 5);

  try {
    const result = await parseApkg(file, msg => {
      step++;
      const pct = Math.round((step / steps.length) * 90);
      showImportOverlay(msg, pct);
    });

    showImportOverlay(`Saving ${result.cards.length} cards…`, 95);

    // Persist to storage
    result.decks.forEach(d => saveDeck(d));
    result.cards.forEach(c => saveCard(c));

    showImportOverlay(
      `✅ Imported ${result.decks.length} deck(s), ${result.cards.length} cards${result.skipped ? ` (${result.skipped} skipped)` : ''}`,
      100, '🎉'
    );

    document.getElementById('import-title').textContent = 'Import complete!';
    setTimeout(() => { hideImportOverlay(); navigate('decks'); }, 2200);

  } catch (err) {
    showImportOverlay(`Error: ${err.message}`, 0, '❌');
    document.getElementById('import-title').textContent = 'Import failed';
    setTimeout(hideImportOverlay, 3500);
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────
function attachHandlers() {
  // Navigation buttons
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      state.editingCard = null;
      state.editingDeck = null;
      navigate(el.dataset.nav);
    });
  });

  // Action buttons
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', e => handleAction(e, el));
  });

  // Forms
  const cardForm = document.getElementById('card-form');
  if (cardForm) cardForm.addEventListener('submit', handleCardSubmit);

  const deckForm = document.getElementById('deck-form');
  if (deckForm) deckForm.addEventListener('submit', handleDeckSubmit);

  // .apkg file input
  const apkgInput = document.getElementById('apkg-input');
  if (apkgInput) {
    apkgInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleApkgImport(file);
    });
  }

  // Keyboard shortcuts for study
  if (state.view === 'study') {
    document.onkeydown = handleStudyKey;
  } else {
    document.onkeydown = null;
  }
}

function handleAction(e, el) {
  const { action, deck, card, rating, color } = el.dataset;
  e.stopPropagation();

  switch (action) {
    case 'study-all':
      startStudy(null);
      break;
    case 'study-deck':
      startStudy(deck);
      break;
    case 'open-deck':
      state.activeDeckId = deck;
      navigate('deck');
      break;
    case 'import-apkg':
      document.getElementById('apkg-input')?.click();
      break;
    case 'flip-card':
      if (!state.study.flipped) {
        state.study.flipped = true;
        render();
      }
      break;
    case 'rate':
      rateCard(parseInt(rating));
      break;
    case 'end-study':
      navigate('home');
      break;
    case 'add-card':
      state.editingCard = null;
      if (deck) state.activeDeckId = deck;
      navigate('add-card');
      break;
    case 'edit-card':
      state.editingCard = getCards().find(c => c.id === card) || null;
      navigate('add-card');
      break;
    case 'delete-card':
      if (confirm('Delete this card?')) {
        deleteCard(card);
        navigate(state.view);
      }
      break;
    case 'add-deck':
      state.editingDeck = null;
      navigate('add-deck');
      break;
    case 'edit-deck':
      state.editingDeck = getDecks().find(d => d.id === deck) || null;
      navigate('add-deck');
      break;
    case 'delete-deck':
      if (confirm('Delete this deck and all its cards?')) {
        deleteDeck(deck);
        navigate('decks');
      }
      break;
    case 'pick-color':
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('color-input').value = color;
      break;
    case 'back-from-form':
      if (state.activeDeckId) navigate('deck');
      else navigate('decks');
      break;
  }
}

function handleStudyKey(e) {
  if (!state.study.flipped) {
    if (e.key === ' ' || e.key === 'Enter') { state.study.flipped = true; render(); }
  } else {
    if (e.key === '1') rateCard(0);
    else if (e.key === '2') rateCard(1);
    else if (e.key === '3') rateCard(2);
    else if (e.key === '4') rateCard(3);
  }
}

function handleCardSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const isEdit = !!state.editingCard;

  const card = isEdit ? { ...state.editingCard, ...data } : {
    id: generateId('card'),
    deckId: data.deckId,
    front: data.front.trim(),
    back: data.back.trim(),
    hint: (data.hint || '').trim(),
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: null,
    lastReviewed: null,
    createdAt: new Date().toISOString(),
  };

  if (isEdit) {
    card.front = data.front.trim();
    card.back = data.back.trim();
    card.hint = (data.hint || '').trim();
    card.deckId = data.deckId;
  }

  saveCard(card);
  state.editingCard = null;
  state.activeDeckId = card.deckId;
  navigate('deck');
}

function handleDeckSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const isEdit = !!state.editingDeck;

  const deck = isEdit ? { ...state.editingDeck, ...data } : {
    id: generateId('deck'),
    name: data.name.trim(),
    description: (data.description || '').trim(),
    color: data.color,
    createdAt: new Date().toISOString(),
  };

  if (isEdit) {
    deck.name = data.name.trim();
    deck.description = (data.description || '').trim();
    deck.color = data.color;
  }

  saveDeck(deck);
  state.editingDeck = null;
  navigate('decks');
}

// ── Study session logic ───────────────────────────────────────────────────────
function startStudy(deckId) {
  const dueCards = getDueCards(deckId);
  if (dueCards.length === 0) return;

  state.activeDeckId = deckId;
  state.study = {
    queue: shuffle(dueCards),
    current: 0,
    flipped: false,
    sessionStats: { again: 0, hard: 0, good: 0, easy: 0 },
  };
  navigate('study');
}

function rateCard(rating) {
  const { queue, current } = state.study;
  const card = queue[current];

  const ratingNames = ['again', 'hard', 'good', 'easy'];
  state.study.sessionStats[ratingNames[rating]]++;

  const updated = { ...card, ...sm2(card, rating) };
  saveCard(updated);
  recordReview();

  // If "again", push card to back of queue
  if (rating === 0) {
    state.study.queue.push({ ...card });
  }

  state.study.current++;
  state.study.flipped = false;
  render();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Init ──────────────────────────────────────────────────────────────────────
initStorage();
render();
