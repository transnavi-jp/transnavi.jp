import type { Clinic } from '../types/clinic';

export type ClinicGenre = 'hrt' | 'mental' | 'srs';

// Mental/diagnosis is decided only by the authoritative service field, the
// clinic id, or the clinic's own name (こころ included so e.g. 武蔵小杉Jこころの
// クリニック is caught). We deliberately never scan `notes`: most HRT clinics
// mention 診断・精神科 there only as a prerequisite, which used to mis-tag HRT
// (even urology) clinics as mental.
const mentalPattern = /(精神科|心療内科|心理|メンタル|こころ)/;

// HRT / beauty clinics that also perform orchiectomy or SRS, plus 札幌医大.
// The dedicated SRS hospitals all use ids that start with "srs". We use an
// explicit allow-list instead of scanning `notes`, because notes also contain
// "SRSは実施せず紹介" / "術後の方" / タイでのSRS推薦状, which are not SRS providers.
const srsCapableClinicIds = new Set<string>([
  'hrt-hokkaido-chuuou-sapmed', // 札幌医科大学付属病院
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

  if (clinic.id.startsWith('srs') || srsCapableClinicIds.has(clinic.id)) {
    categories.add('srs');
  }

  return [...categories];
}

// One pin colour per clinic: surgery-capable first, then HRT, then mental.
export function primaryGenre(categories: string[]): ClinicGenre {
  return categories.includes('srs') ? 'srs' : categories.includes('hrt') ? 'hrt' : 'mental';
}
