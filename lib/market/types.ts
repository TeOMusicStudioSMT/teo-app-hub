
export interface MarketListing {
  id: string;
  sellerDid: string;
  itemName: string;
  description: string;
  price: number; // in GRV
  imageUrl: string;
}

export interface CreateListingRequest {
  itemName: string;
  price: number;
  description?: string;
}
