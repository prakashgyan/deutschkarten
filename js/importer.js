// .apkg importer
// .apkg = zip(collection.anki21 | collection.anki2 [SQLite] + media files)

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const COLORS = ['#7c3aed','#0891b2','#059669','#d97706','#dc2626','#4f46e5','#db2777','#0284c7'];
let colorIdx = 0;
function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

export async function parseApkg(file, onProgress) {
  onProgress('Loading libraries…');

  // Lazy-load JSZip and sql.js only when needed
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js');

  onProgress('Reading file…');
  const buffer = await file.arrayBuffer();

  onProgress('Extracting archive…');
  // JSZip is a global after script load
  const zip = await window.JSZip.loadAsync(buffer);

  // Prefer newer anki21 format, fall back to anki2
  const dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbFile) throw new Error('No collection database found in .apkg — is this a valid Anki file?');

  onProgress('Opening database…');
  const dbData = await dbFile.async('uint8array');

  const SQL = await window.initSqlJs({
    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`,
  });

  const db = new SQL.Database(dbData);

  onProgress('Parsing decks…');

  // Read collection metadata (decks JSON lives in col table)
  const colRows = db.exec('SELECT decks FROM col LIMIT 1');
  if (!colRows.length) throw new Error('Empty collection');
  const decksJson = JSON.parse(colRows[0].values[0][0]);

  // Read all notes — flds contains fields separated by \x1f (unit separator)
  const notesRows = db.exec('SELECT id, tags, flds FROM notes');
  const notes = notesRows[0]?.values || [];

  // Read cards to map note → deck
  const cardsRows = db.exec('SELECT nid, did FROM cards');
  const cardRows = cardsRows[0]?.values || [];

  db.close();

  // note id → deck id (take first card per note)
  const noteToDeckId = {};
  for (const [nid, did] of cardRows) {
    if (!noteToDeckId[nid]) noteToDeckId[nid] = String(did);
  }

  // Build deck lookup (skip the built-in "Default" deck id=1)
  const deckMeta = {};
  for (const [id, deck] of Object.entries(decksJson)) {
    if (id === '1') continue;
    deckMeta[String(id)] = { name: deck.name, appId: `deck-apkg-${id}` };
  }

  onProgress('Importing cards…');

  const importedDecks = {};
  const importedCards = [];
  let skipped = 0;

  for (const [noteId, tags, flds] of notes) {
    const fields = flds.split('\x1f');
    const front = stripHtml(fields[0]);
    const back  = stripHtml(fields[1]);

    if (!front || !back) { skipped++; continue; }

    const deckId = noteToDeckId[noteId];
    const meta = deckMeta[deckId];
    if (!meta) { skipped++; continue; }

    if (!importedDecks[deckId]) {
      importedDecks[deckId] = {
        id: meta.appId,
        name: meta.name,
        description: 'Imported from .apkg',
        color: nextColor(),
      };
    }

    importedCards.push({
      id: `card-apkg-${noteId}`,
      deckId: meta.appId,
      front,
      back,
      hint: (tags || '').trim(),
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: null,
      lastReviewed: null,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    decks: Object.values(importedDecks),
    cards: importedCards,
    skipped,
  };
}
