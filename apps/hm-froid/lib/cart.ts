export type CartItem = {
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  unitPrice: string;
  quantity: number;
  image: string | null;
};

export const CART_STORAGE_KEY = "hmf-storefront-cart-v1";
export const MAX_CART_ITEMS = 20;
export const MAX_ITEM_QUANTITY = 20;
