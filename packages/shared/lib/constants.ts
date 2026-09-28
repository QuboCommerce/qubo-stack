export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export const PAYMENT_METHODS = [
  "CARD",
  "BANK_TRANSFER",
  "BNPL",
  "CASH_ON_DELIVERY",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  CARD: "Carte bancaire",
  BANK_TRANSFER: "Virement bancaire",
  BNPL: "Paiement en plusieurs fois",
  CASH_ON_DELIVERY: "Paiement à la livraison",
};

export const USER_ROLES = ["ADMIN", "STAFF", "CUSTOMER"] as const;

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP"] as const;

export const BELGIAN_TVA_RATE = 21.0;

export const DEFAULT_LOCALE = "fr-BE";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "Europe/Brussels";
