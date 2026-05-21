// SM-2 Spaced Repetition Algorithm
// rating: 0=Again, 1=Hard, 2=Good, 3=Easy

export function sm2(card, rating) {
  let { interval = 0, easeFactor = 2.5, repetitions = 0 } = card;

  if (rating === 0) {
    // Again — reset
    repetitions = 0;
    interval = 1;
  } else if (rating === 1) {
    // Hard — slight increase, ease decreases
    interval = Math.max(1, Math.ceil(interval * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
    if (repetitions === 0) { interval = 1; repetitions = 1; }
  } else if (rating === 2) {
    // Good
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  } else {
    // Easy — bonus interval, ease increases
    if (repetitions === 0) interval = 4;
    else if (repetitions === 1) interval = 10;
    else interval = Math.round(interval * easeFactor * 1.3);
    repetitions++;
    easeFactor = Math.min(2.5, easeFactor + 0.15);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return {
    interval,
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    repetitions,
    dueDate: dueDate.toISOString(),
    lastReviewed: new Date().toISOString(),
  };
}

export function isDue(card) {
  if (!card.dueDate) return true;
  return new Date(card.dueDate) <= new Date();
}

export function getDueCount(cards) {
  return cards.filter(isDue).length;
}
