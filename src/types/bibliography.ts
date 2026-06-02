export type BibCategory = 'jp-intro' | 'jp-academic' | 'intl' | 'evidence';

export interface BibEntry {
  type: 'book' | 'article' | 'guideline';
  authors: string;
  title: string;
  venue: string;
  year: string;
  url: string;
  language: 'ja' | 'en' | 'zh' | 'ko' | 'other';
  category: BibCategory;
  note?: string;
}

export const bibCategoryMeta: { key: BibCategory; title: string; description: string }[] = [
  { key: 'jp-intro', title: 'はじめに読む（日本語の入門）', description: 'まず手に取りたい、日本語の入門書・概説書・当事者の本。' },
  { key: 'jp-academic', title: 'もっと深く（日本語の専門書・研究）', description: '歴史・社会・法・教育などをあつかう、日本語の専門書や研究。' },
  { key: 'intl', title: '海外の書籍・論考（歴史・理論）', description: '英語・中国語・韓国語など、海外の、トランスジェンダーに関する書籍と、よく知られた論考。' },
  { key: 'evidence', title: '医療の根拠（ガイドライン・医学研究）', description: '診療ガイドラインと、ホルモン療法・手術・健康などに関する研究。' },
];
