import type { Clinic } from '../types/clinic';

// Top-level 診療区分 (care-purpose, not hospital department): hormones, diagnosis,
// or surgery. These are tags — a facility can have several (a GID centre does
// all three). 手術 is an umbrella; the specific procedure is a sub-type below.
export type ClinicGenre = 'hrt' | 'mental' | 'surgery';
export type SurgeryType = 'SRS' | 'VFS' | 'FFS';

const mentalPattern = /(精神科|心療内科|心理|メンタル|こころ)/;

// HRT / beauty clinics that also perform orchiectomy or SRS, plus 札幌医大. The
// dedicated surgery facilities carry the procedure in their `services`, so they
// are detected automatically; these have it only in `notes`, hence an allow-list.
const surgeryClinicIds = new Set<string>([
  'hrt-hokkaido-chuuou-sapmed',
  'hrt-aichi-nagumo',
  'hrt-kanagawa-kawasaki',
  'hrt-osaka-amore',
  'hrt-osaka-drgoldman',
  'hrt-osaka-nagumo',
  'hrt-tokyo-nagumo',
  'hrt-tokyo-yasumi',
  'hrt-tokyo-mc',
  'hrt-fukuoka-nagumo',
  'hrt-tokyo-athena',
  'hrt-tokyo-gender-clinic',
]);

const offersSurgery = (clinic: Clinic) =>
  clinic.id.startsWith('srs') ||
  clinic.id.startsWith('vfs') ||
  clinic.id.startsWith('ffs') ||
  surgeryClinicIds.has(clinic.id) ||
  clinic.services.some((s) => s.includes('手術'));

// A facility is overseas when it carries a `country` (domestic clinics omit it).
export const isOverseas = (clinic: Clinic): boolean => Boolean(clinic.country) && clinic.country !== '日本';

// ISO 3166-1 alpha-2 for the countries we list, for structured-data addressCountry.
const COUNTRY_ISO: Record<string, string> = { 日本: 'JP', タイ: 'TH', 韓国: 'KR' };
export const countryIso = (clinic: Clinic): string => COUNTRY_ISO[clinic.country ?? '日本'] ?? 'JP';

export function categoriesOf(clinic: Clinic): ClinicGenre[] {
  const categories = new Set<ClinicGenre>();

  if (clinic.id.startsWith('hrt') || clinic.services.some((service) => service.includes('ホルモン'))) {
    categories.add('hrt');
  }
  if (
    clinic.id.startsWith('psyco') ||
    clinic.services.some((service) => service.includes('精神') || service.includes('診断')) ||
    mentalPattern.test(clinic.name)
  ) {
    categories.add('mental');
  }
  if (offersSurgery(clinic)) {
    categories.add('surgery');
  }

  return [...categories];
}

// Sub-types of 手術. VFS = 声の女性化, SRS = 性別適合（去勢・造腟など）, FFS = 顔の
// 女性化 (no facilities tagged yet — added when data exists).
export function surgeryTypesOf(clinic: Clinic): SurgeryType[] {
  const t = new Set<SurgeryType>();
  if (clinic.services.some((s) => s.includes('声'))) t.add('VFS');
  if (clinic.id.startsWith('ffs') || clinic.services.some((s) => s.includes('FFS') || s.includes('顔の女性化'))) t.add('FFS');
  if (
    clinic.id.startsWith('srs') ||
    surgeryClinicIds.has(clinic.id) ||
    clinic.services.some((s) => s.includes('性別適合'))
  ) {
    t.add('SRS');
  }
  return [...t];
}

// One pin colour per facility: surgery first (most specialised), then HRT, then mental.
export function primaryGenre(categories: ClinicGenre[]): ClinicGenre {
  return categories.includes('surgery') ? 'surgery' : categories.includes('hrt') ? 'hrt' : 'mental';
}

// Finer-grained "what is documented here" tags, derived ONLY from what the data
// actually states (structured services + the free-text notes). The absence of a
// tag is NOT a claim that a facility doesn't offer it — much of the imported data
// simply doesn't say. The UI says so; we never infer a negative. This keeps the
// tags honest and within the site's no-capability-claims policy.
export type Capability =
  | 'gaht-feminizing'
  | 'gaht-masculinizing'
  | 'surgery-srs'
  | 'surgery-vaginoplasty'
  | 'surgery-orchiectomy'
  | 'surgery-phalloplasty'
  | 'surgery-hysterectomy'
  | 'surgery-mastectomy'
  | 'surgery-vfs'
  | 'surgery-ffs'
  | 'surgery-breast';

export const CAPABILITY_LABELS: Record<Capability, string> = {
  'gaht-feminizing': '女性化ホルモン（MtF）',
  'gaht-masculinizing': '男性化ホルモン（FtM）',
  'surgery-srs': '性別適合手術（SRS）',
  'surgery-vaginoplasty': '造腟術',
  'surgery-orchiectomy': '睾丸摘出術',
  'surgery-phalloplasty': '陰茎形成術',
  'surgery-hysterectomy': '子宮・卵巣摘出',
  'surgery-mastectomy': '乳房切除（胸オペ）',
  'surgery-vfs': '声の手術（VFS）',
  'surgery-ffs': '顔の手術（FFS）',
  'surgery-breast': '豊胸',
};

// Direction is only claimed when the notes name it (MtF/FtM or 女性化/男性化
// ホルモン). Plain "ホルモン療法" with no direction yields no GAHT tag.
const FEMINIZING = /(ＭＴＦ|MTF|MtF|mtf|男性から女性|女性化ホルモン|女性ホルモン)/;
const MASCULINIZING = /(ＦＴＭ|FTM|FtM|ftm|女性から男性|男性化ホルモン|男性ホルモン)/;
// Specific procedures, named in the notes. Genital/internal ones are more precise
// than the generic SRS umbrella, so when one is found the umbrella is suppressed
// (e.g. an orchiectomy-only clinic should not read as offering full SRS).
const ORCHIECTOMY = /睾丸摘出|精巣摘出|去勢/;
const VAGINOPLASTY = /造腟|造膣|腟形成|膣形成/;
const PHALLOPLASTY = /陰茎形成|陰茎再建/;
const HYSTERECTOMY = /子宮摘出|卵巣摘出|子宮全摘|内性器摘出/;
const MASTECTOMY = /乳房切除|乳腺摘出|胸オペ/;
const BREAST_AUG = /(豊胸|豊乳|乳房増大|バストアップ)/;
const VFS_TEXT = /(ＶＦＳ|VFS|声の(女性化)?手術|音声の?手術|声帯手術)/;
const FFS_TEXT = /(ＦＦＳ|FFS|顔面女性化|顔の女性化)/;

// Negation that immediately follows a procedure word and flips it negative — e.g.
// 「豊胸術を行わずに女性化」 mentions 豊胸 only to say it ISN'T needed. Such a
// mention must NOT produce a capability tag. Matched within a short window after
// the keyword (allowing a trailing 術/など etc.).
const NEGATION_AFTER =
  /^[^。\n、]{0,8}?(行わ(ず|ない|ぬ)|行いません|行っていな(い|ければ)|行っていません|なし|無し|不要|せず|しな(い|いで)|しません|していな(い|ければ)|していません|対応していな|扱っていな|要しない)/;

// True when `re` matches the text in at least one place that is NOT negated, so
// affirmative mentions tag and negated-only mentions ("〜を行わず") do not.
function statesAffirmatively(text: string, re: RegExp): boolean {
  const g = new RegExp(re.source, re.global ? re.flags : `${re.flags}g`);
  for (let m = g.exec(text); m; m = g.exec(text)) {
    if (!NEGATION_AFTER.test(text.slice(m.index + m[0].length))) return true;
    if (m.index === g.lastIndex) g.lastIndex++; // guard against zero-width matches
  }
  return false;
}

export function capabilitiesOf(clinic: Clinic): Capability[] {
  const text = `${clinic.notes ?? ''} ${clinic.services.join(' ')}`;
  const caps: Capability[] = [];

  // GAHT direction is gated on the facility actually doing hormones, so a
  // surgery-only clinic that mentions "MtF" in passing isn't tagged as GAHT.
  if (categoriesOf(clinic).includes('hrt')) {
    if (statesAffirmatively(text, FEMINIZING)) caps.push('gaht-feminizing');
    if (statesAffirmatively(text, MASCULINIZING)) caps.push('gaht-masculinizing');
  }

  const surgery = surgeryTypesOf(clinic);
  const vaginoplasty = statesAffirmatively(text, VAGINOPLASTY);
  const orchiectomy = statesAffirmatively(text, ORCHIECTOMY);
  const phalloplasty = statesAffirmatively(text, PHALLOPLASTY);
  const hysterectomy = statesAffirmatively(text, HYSTERECTOMY);
  const hasSpecificGenital = vaginoplasty || orchiectomy || phalloplasty || hysterectomy;

  // The generic 性別適合手術（SRS） umbrella — only when no specific genital
  // procedure is named (otherwise the specific tag is shown instead, for accuracy).
  if (surgery.includes('SRS') && !hasSpecificGenital) caps.push('surgery-srs');
  if (vaginoplasty) caps.push('surgery-vaginoplasty');
  if (orchiectomy) caps.push('surgery-orchiectomy');
  if (phalloplasty) caps.push('surgery-phalloplasty');
  if (hysterectomy) caps.push('surgery-hysterectomy');
  if (statesAffirmatively(text, MASTECTOMY)) caps.push('surgery-mastectomy');
  if (surgery.includes('VFS') || statesAffirmatively(text, VFS_TEXT)) caps.push('surgery-vfs');
  if (surgery.includes('FFS') || statesAffirmatively(text, FFS_TEXT)) caps.push('surgery-ffs');
  if (statesAffirmatively(text, BREAST_AUG)) caps.push('surgery-breast');

  return caps;
}

// 日本GI（性別不合）学会の認定施設 — the facilities where 性別適合手術 can be
// covered by insurance. From the society's published list (gi-soc.jp) and the
// facilities' own pages; confirmed entries only. Certification changes over time
// and this is NOT exhaustive, so the UI links readers to the official list.
const GI_CERTIFIED_IDS = new Set<string>([
  'srs-okayama-u',              // 岡山大学病院
  'srs-yamanashi-u',            // 山梨大学医学部附属病院
  'srs-aichi-nagoya-u',         // 名古屋大学医学部附属病院
  'hrt-hokkaido-chuuou-sapmed', // 札幌医科大学附属病院
  'srs-okinawa-chubu',          // 沖縄県立中部病院
  'srs-chiba-gyotoku',          // 行徳総合病院（2021年認定）
]);

export const isGiCertified = (clinic: Clinic): boolean => GI_CERTIFIED_IDS.has(clinic.id);

const GENRE_LABEL: Record<ClinicGenre, string> = {
  hrt: 'ホルモン療法',
  mental: '精神科・診断',
  surgery: '手術',
};

// Short tag labels for a clinic, shown on the map popup (and reusable on cards):
// the specific capabilities (女性化ホルモン（MtF）, 性別適合手術（SRS）…), falling back to
// the 診療区分 when no direction/procedure is named, plus GI学会認定 when certified.
export function clinicMapTags(clinic: Clinic): string[] {
  const caps = capabilitiesOf(clinic).map((cap) => CAPABILITY_LABELS[cap]);
  const base = caps.length ? caps : categoriesOf(clinic).map((g) => GENRE_LABEL[g]);
  return isGiCertified(clinic) ? [...base, 'GI学会認定'] : base;
}
