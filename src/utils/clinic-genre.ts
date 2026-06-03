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
  surgeryClinicIds.has(clinic.id) ||
  clinic.services.some((s) => s.includes('手術'));

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
  if (clinic.services.some((s) => s.includes('FFS') || s.includes('顔の女性化'))) t.add('FFS');
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
export function primaryGenre(categories: string[]): ClinicGenre {
  return categories.includes('surgery') ? 'surgery' : categories.includes('hrt') ? 'hrt' : 'mental';
}
