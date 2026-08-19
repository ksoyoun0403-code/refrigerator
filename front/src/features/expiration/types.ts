export type ExpirationItem = {
  id: string;
  name: string;
  expirationDate: string;
  source: 'image' | 'manual';
  createdAt: string;
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
};

export type LocalImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};
