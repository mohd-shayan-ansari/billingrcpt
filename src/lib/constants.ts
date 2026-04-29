export const RECEIPT_KEYS = ["andar", "bahar", "result"] as const;

export const ITEM_LABELS = {
  andar: "Andar",
  bahar: "Bahar",
  result: "Result",
} as const;

export const DEFAULT_MASTER_CREDENTIALS = {
  name: "Master Admin",
  password: "Admin@1234",
};

export const DEFAULT_RATES = {
  andar: 12,
  bahar: 55,
  result: 110,
} as const;

export const ROLE_LABELS = {
  MASTER_ADMIN: "Master Admin",
  COUNTER_ADMIN: "Counter Admin",
} as const;