export const EXPIRATION_ITEM_UNITS = [
  'COUNT',
  'G',
  'KG',
  'ML',
  'L',
  'PACK',
  'BAG',
  'BOTTLE',
  'CAN',
] as const;

export type ExpirationItemUnit = (typeof EXPIRATION_ITEM_UNITS)[number];

export type ExpirationItem = {
  id: string;
  scanId: string;
  name: string;
  quantity: string;
  unit: ExpirationItemUnit;
  purchasedAt: string;
  expirationDate: string | null;
  source: 'image';
  section: 'DEFAULT' | 'USE_SOON';
  sortOrder: number;
  createdAt: string;
};

export type CreateExpirationItem = {
  scanId: string;
  name: string;
  quantity: string;
  unit: ExpirationItemUnit;
  expirationDate: string | null;
};

export type UpdateExpirationItem = {
  name?: string;
  quantity?: string;
  unit?: ExpirationItemUnit;
  purchasedAt?: string;
  expirationDate?: string | null;
  section?: ExpirationItem['section'];
};

export type ExpirationCandidate = {
  rawText: string;
  expirationDate: string;
  confidence: number;
  requiresConfirmation: boolean;
};

export type ExpirationScanResult = {
  scanId: string;
  status: 'needs_review';
  candidates: ExpirationCandidate[];
  failureReason:
    | 'NO_TEXT_DETECTED'
    | 'LOW_QUALITY_TEXT'
    | 'NO_DATE_DETECTED'
    | null;
};

export type LocalImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};
