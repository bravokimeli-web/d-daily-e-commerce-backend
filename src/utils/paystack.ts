import axios from "axios";

const PAYSTACK_BASE = "https://api.paystack.co";

const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: "success" | "failed" | "abandoned" | "pending";
    reference: string;
    amount: number; // in kobo (multiply by 100 when sending, divide by 100 when reading)
    currency: string;
    paid_at: string;
    channel: string;
    customer: {
      email: string;
      phone: string;
    };
  };
}

/**
 * Initialize a Paystack transaction.
 * Amount must be in the smallest currency unit (kobo for NGN, pesewas for GHS).
 * For KES, Paystack uses the base unit directly — amount in KES cents (multiply KES by 100).
 */
export const initializePayment = async (params: {
  email: string;
  amount: number; // in KES (we convert to kobo/pesewas internally)
  reference: string;
  currency?: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResponse> => {
  const { data } = await paystackClient.post<PaystackInitResponse>("/transaction/initialize", {
    email: params.email,
    amount: Math.round(params.amount * 100), // Paystack requires amount in smallest unit
    reference: params.reference,
    currency: params.currency ?? "KES",
    callback_url: params.callbackUrl,
    metadata: params.metadata ?? {},
  });
  return data;
};

/**
 * Verify a Paystack transaction by reference.
 */
export const verifyPayment = async (reference: string): Promise<PaystackVerifyResponse> => {
  const { data } = await paystackClient.get<PaystackVerifyResponse>(
    `/transaction/verify/${reference}`
  );
  return data;
};

/**
 * Generate a unique order reference string.
 */
export const generateReference = (orderNumber: string): string => {
  const timestamp = Date.now();
  return `DDAILY-${orderNumber}-${timestamp}`;
};
