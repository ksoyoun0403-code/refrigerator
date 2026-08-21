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
  source: 'image' | 'manual';
  section: 'DEFAULT' | 'USE_SOON';
  sortOrder: number;
  createdAt: string;
};

export type CreateExpirationItem = {
  scanId?: string;
  name: string;
  quantity: string;
  unit: ExpirationItemUnit;
  purchasedAt?: string;
  expirationDate?: string | null;
};

export type UpdateExpirationItem = {
  name?: string;
  quantity?: string;
  unit?: ExpirationItemUnit;
  purchasedAt?: string;
  expirationDate?: string | null;
  section?: 'DEFAULT' | 'USE_SOON';
};
