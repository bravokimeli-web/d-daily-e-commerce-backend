import axios from "axios";

const MPESA_BASE_URL = process.env.MPESA_BASE_URL?.trim() || "https://sandbox.safaricom.co.ke";
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE?.trim();
const MPESA_PASSKEY = process.env.MPESA_PASSKEY?.trim();
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL?.trim();

export interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface MpesaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  throw new Error("Phone number must be a valid Kenyan number like 0712345678 or +254712345678.");
}

function getTimestamp(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

async function getAccessToken(): Promise<string> {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error("Missing MPESA consumer key or secret.");
  }

  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const url = `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;

  const response = await axios.get<MpesaAccessTokenResponse>(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.data?.access_token) {
    throw new Error("Failed to obtain M-Pesa access token.");
  }

  return response.data.access_token;
}

function getPassword(timestamp: string): string {
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new Error("Missing MPESA shortcode or passkey.");
  }
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
}

export const initiateStkPush = async (params: {
  amount: number;
  phone: string;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
}): Promise<MpesaStkPushResponse> => {
  const normalizedPhone = normalizePhoneNumber(params.phone);
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);
  const callbackUrl = params.callbackUrl?.trim() || MPESA_CALLBACK_URL;

  if (!callbackUrl) {
    throw new Error("Missing MPESA callback URL. Set MPESA_CALLBACK_URL in the environment.");
  }

  const response = await axios.post<MpesaStkPushResponse>(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(params.amount),
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: callbackUrl,
      AccountReference: params.accountReference,
      TransactionDesc: params.transactionDesc,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data;
  if (!data || data.ResponseCode !== "0") {
    throw new Error(
      `M-Pesa STK push failed${data?.ResponseCode ? ` (${data.ResponseCode})` : ""}: ${data?.ResponseDescription || data?.CustomerMessage || "Unknown error"}`
    );
  }

  return data;
};

export const generateReference = (orderNumber: string) => `MPESA-${orderNumber}-${Date.now()}`;

export const parseStkCallback = (body: any) => {
  const callback = body?.Body?.stkCallback;
  if (!callback) {
    throw new Error("Invalid M-Pesa callback payload.");
  }

  const items: Array<{ Name: string; Value: any }> = callback?.CallbackMetadata?.Item ?? [];
  const findItem = (name: string) => items.find((item) => item.Name === name)?.Value;

  return {
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    merchantRequestID: callback.MerchantRequestID,
    checkoutRequestID: callback.CheckoutRequestID,
    receiptNumber: findItem("MpesaReceiptNumber"),
    amount: findItem("Amount"),
    phoneNumber: findItem("PhoneNumber"),
  };
};
