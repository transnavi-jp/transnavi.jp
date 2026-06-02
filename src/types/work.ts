export type WorkCategory =
  | 'music'
  | 'film'
  | 'manga'
  | 'novel'
  | 'tv-drama'
  | 'tv-anime'
  | 'game'
  | 'bishojo-game';

export interface Work {
  id: string;
  title: string;
  category: WorkCategory;
  year: number | null;
  url: string | null;
  /** Parent series this entry belongs to, if any. */
  series?: string;
  /** Adult / 18+ content. */
  adult?: boolean;
  /** Poster / thumbnail image URL (populated by scripts/fetch-work-posters.mjs). */
  poster?: string | null;
  /** Topical tags describing what the work is about. */
  tags?: string[];
  /** Widely-known / mainstream work — surfaced with a 人気 badge and filter. */
  popular?: boolean;
  note?: string;
}

export const workCategoryLabels: Record<WorkCategory, string> = {
  music: '音楽',
  film: '映画',
  manga: '漫画',
  novel: '小説',
  'tv-drama': 'テレビドラマ',
  'tv-anime': 'テレビアニメ',
  game: 'ゲーム',
  'bishojo-game': '美少女ゲーム',
};

export const workCategoryOrder: WorkCategory[] = [
  'music',
  'film',
  'manga',
  'novel',
  'tv-drama',
  'tv-anime',
  'game',
  'bishojo-game',
];
