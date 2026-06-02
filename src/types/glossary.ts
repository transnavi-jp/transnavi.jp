export interface GlossaryEntry {
  id: string;
  term: string;
  abbr?: string;
  category: string;
  wikidata?: string;
  translations: {
    en?: string;
    zhHans?: string;
    zhHant?: string;
    es?: string;
    ko?: string;
    th?: string;
  };
  aliases: string[];
  avoid: string[];
  disputed: string[];
  notes?: string;
  source?: string;
  /** Optional gentle message shown to readers (e.g. a self-compassion note). */
  message?: string;
}
