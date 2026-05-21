// Storage layer using localStorage

import { DEFAULT_DECKS, DEFAULT_CARDS } from './data.js';

const KEYS = {
  DECKS: 'flashcards_decks',
  CARDS: 'flashcards_cards',
  STATS: 'flashcards_stats',
  SETTINGS: 'flashcards_settings',
};

function load(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function initStorage() {
  if (!load(KEYS.DECKS)) {
    save(KEYS.DECKS, DEFAULT_DECKS);
    // Stamp default cards with SRS defaults
    const cards = DEFAULT_CARDS.map(c => ({
      ...c,
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: null,
      lastReviewed: null,
      createdAt: new Date().toISOString(),
    }));
    save(KEYS.CARDS, cards);
  }
  if (!load(KEYS.STATS)) {
    save(KEYS.STATS, { streak: 0, lastStudyDate: null, totalReviews: 0, todayReviews: 0 });
  }
}

// Decks
export function getDecks() { return load(KEYS.DECKS) || []; }
export function saveDeck(deck) {
  const decks = getDecks();
  const idx = decks.findIndex(d => d.id === deck.id);
  if (idx >= 0) decks[idx] = deck; else decks.push(deck);
  save(KEYS.DECKS, decks);
}
export function deleteDeck(deckId) {
  save(KEYS.DECKS, getDecks().filter(d => d.id !== deckId));
  save(KEYS.CARDS, getCards().filter(c => c.deckId !== deckId));
}

// Cards
export function getCards() { return load(KEYS.CARDS) || []; }
export function getCardsByDeck(deckId) { return getCards().filter(c => c.deckId === deckId); }
export function saveCard(card) {
  const cards = getCards();
  const idx = cards.findIndex(c => c.id === card.id);
  if (idx >= 0) cards[idx] = card; else cards.push(card);
  save(KEYS.CARDS, cards);
}
export function deleteCard(cardId) {
  save(KEYS.CARDS, getCards().filter(c => c.id !== cardId));
}

// Stats
export function getStats() { return load(KEYS.STATS) || { streak: 0, lastStudyDate: null, totalReviews: 0, todayReviews: 0 }; }
export function recordReview() {
  const stats = getStats();
  const today = new Date().toDateString();
  const last = stats.lastStudyDate;

  if (last !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    stats.streak = last === yesterday.toDateString() ? stats.streak + 1 : 1;
    stats.lastStudyDate = today;
    stats.todayReviews = 0;
  }
  stats.totalReviews = (stats.totalReviews || 0) + 1;
  stats.todayReviews = (stats.todayReviews || 0) + 1;
  save(KEYS.STATS, stats);
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
