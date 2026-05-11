/**
 * Generates a human-readable order number like DDL-20240510-0042
 */
export const generateOrderNumber = (): string => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `DDL-${datePart}-${random}`;
};

/**
 * Formats a number as KES currency string
 */
export const formatKES = (amount: number): string =>
  `KES ${amount.toLocaleString("en-KE")}`;
