export type BibCategory = 'jp-intro' | 'jp-academic' | 'intl-book' | 'guideline' | 'article';

export interface BibEntry {
  type: 'book' | 'article' | 'guideline';
  authors: string;
  title: string;
  venue: string;
  year: string;
  url: string;
  language: 'ja' | 'en' | 'other';
  category: BibCategory;
  note?: string;
}

export const bibCategoryMeta: { key: BibCategory; title: string; description: string }[] = [
  { key: 'jp-intro', title: '入門・概説（日本語）', description: '学術的に知りたいときの、日本語の入門書・概説書。' },
  { key: 'jp-academic', title: '専門書・研究（日本語）', description: '歴史・社会・医療などをあつかう、日本語の専門書や研究。' },
  { key: 'intl-book', title: '海外の書籍', description: '主に英語の、トランスジェンダーに関する書籍。' },
  { key: 'guideline', title: '診療ガイドライン・基準', description: '医療の標準やガイドライン。' },
  { key: 'article', title: '学術論文', description: '査読論文や、参照に値する論考。' },
];
