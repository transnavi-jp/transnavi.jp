export interface Clinic {
  id: string;
  name: string;
  displayName: string;
  prefecture: string;
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
