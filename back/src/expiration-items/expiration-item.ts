export type ExpirationItem = {
  id: string;
  name: string;
  expirationDate: string;
  source: 'image' | 'manual';
  createdAt: string;
};

export type CreateExpirationItem = Pick<
  ExpirationItem,
  'name' | 'expirationDate' | 'source'
>;
