import fs from 'fs';
import path from 'path';

export interface WikiNote {
  slug: string;
  topic: string;
  category: 'project' | 'decision' | 'preference' | 'contact' | 'goal' | 'reference';
  summary: string;
  content: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const WIKI_FILE = path.join(DATA_DIR, 'chief-of-staff-wiki.json');

// In-memory mirror so serverless environments with read-only filesystems still work within warm instances
let memoryWikiCache: WikiNote[] | null = null;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'note';
}

export function loadWikiNotes(): WikiNote[] {
  if (memoryWikiCache) {
    return memoryWikiCache;
  }
  try {
    if (fs.existsSync(WIKI_FILE)) {
      const raw = fs.readFileSync(WIKI_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryWikiCache = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to in-memory cache if filesystem is unavailable
  }
  memoryWikiCache = [];
  return memoryWikiCache;
}

function saveWikiNotes(notes: WikiNote[]): void {
  memoryWikiCache = notes;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(WIKI_FILE, JSON.stringify(notes, null, 2), 'utf8');
  } catch {
    // Ignore write errors on read-only serverless filesystems; memoryWikiCache stays updated
  }
}

export function upsertWikiNote(params: {
  topic: string;
  category?: WikiNote['category'];
  summary: string;
  content: string;
}): WikiNote {
  const notes = [...loadWikiNotes()];
  const slug = slugify(params.topic);
  const now = new Date().toISOString();
  const category = params.category || 'project';

  const existingIndex = notes.findIndex((n) => n.slug === slug);
  const note: WikiNote = {
    slug,
    topic: params.topic.trim(),
    category,
    summary: params.summary.trim(),
    content: params.content.trim(),
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    notes[existingIndex] = note;
  } else {
    notes.unshift(note);
  }

  saveWikiNotes(notes);
  return note;
}

export function queryWikiNotes(query?: string): WikiNote[] {
  const notes = loadWikiNotes();
  if (!query || !query.trim()) {
    return notes.slice(0, 20);
  }
  const q = query.toLowerCase().trim();
  return notes.filter(
    (n) =>
      n.topic.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
  );
}
