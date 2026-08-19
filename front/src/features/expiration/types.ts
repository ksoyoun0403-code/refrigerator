export type ExpirationItem = {
  id: string;
  name: string;
  expirationDate: string;
  source: 'image' | 'manual';
  createdAt: string;
};

export type ExpirationCandidate = {
  name: string;
  expirationDate: string | null;
  confidence: number;
};

export type ExpirationScanResult = {
  scanId: string;
  status: 'needs_review';
  candidates: ExpirationCandidate[];
};

export type LocalImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};
