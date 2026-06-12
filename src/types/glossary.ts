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
  wikipedia?: {
    ja?: string;
    en?: string;
    zhHans?: string;
    zhHant?: string;
    ko?: string;
    th?: string;
    es?: string;
  };
  aliases: string[];
  /** Cross-cutting labels from a controlled vocabulary (topic / population /
   *  register), in addition to the single primary `category`. */
  tags: string[];
  avoid: string[];
  disputed: string[];
  notes?: string;
  source?: string;
  /** Hand-curated related glossary ids (antonyms, complements, umbrella terms),
   *  rendered as 「関連することば」 ahead of the automatic category siblings. */
  seeAlso?: string[];
  /** Optional gentle message shown to readers (e.g. a self-compassion note). */
  message?: string;
}
