export type SellerId = string;

export type Seller = {
  id: SellerId;
  label: string;
  color: string;
  bank: string;
  holder: string;
  accountDisplay: string;
  accountCopy: string;
};

export type AppConfig = {
  shopName: string;
  sellers: Seller[];
};

export function getSeller(config: AppConfig, id: string | null): Seller | null {
  return config.sellers.find((seller) => seller.id === id) ?? null;
}
