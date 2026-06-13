export interface Clinic {
  id: string;
  name: string;
  displayName: string;
  prefecture: string;
  /** Set for overseas facilities (e.g. 'タイ', '韓国'); absent/undefined means
   *  domestic (Japan). For overseas entries `prefecture` holds the country too,
   *  so the list groups them under a country heading. */
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  urls: string[];
  services: string[];
  source: {
    project: string;
    path: string;
    license: string;
  };
  verificationStatus: string;
  importedAt: string;
  notes: string;
  lat?: number;
  lng?: number;
  geoSource?: string;
}
