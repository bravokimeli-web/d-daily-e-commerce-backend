/**
 * Safaricom Daraja — Lipa Na M-Pesa Online (M-Pesa Express / STK Push)
 *
 * Official flow:
 * 1. OAuth token  → GET  {base}/oauth/v1/generate?grant_type=client_credentials
 * 2. STK Push     → POST {base}/mpesa/stkpush/v1/processrequest
 * 3. STK Query    → POST {base}/mpesa/stkpushquery/v1/query
 * 4. Callback     → POST your CallBackURL (webhook)
 *
 * Parameter definitions (Safaricom Daraja Lipa Na M-Pesa Online API):
 * - BusinessShortCode: Lipa Na M-Pesa Online shortcode from your Daraja Production app
 * - Password:          base64( BusinessShortCode + Passkey + Timestamp )
 * - Timestamp:         Africa/Nairobi, format YYYYMMDDHHmmss
 * - TransactionType:   CustomerBuyGoodsOnline (till) | CustomerPayBillOnline (paybill)
 * - PartyA:            customer phone, MSISDN 254XXXXXXXXX (12 digits)
 * - PartyB:            same value as BusinessShortCode
 * - PhoneNumber:       same value as PartyA (receives the STK prompt)
 * - AccountReference:  max 12 characters
 * - TransactionDesc:   max 13 characters
 *
 * Ref: developer.safaricom.co.ke → Lipa Na M-Pesa Online → STK Push API
 */
import axios from "axios";

const MPESA_PRODUCTION_URL = "https://api.safaricom.co.ke";
const MPESA_SANDBOX_URL = "https://sandbox.safaricom.co.ke";

const MPESA_BASE_URL =
  process.env.MPESA_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? MPESA_PRODUCTION_URL : MPESA_SANDBOX_URL);
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE?.trim();
const MPESA_PASSKEY = process.env.MPESA_PASSKEY?.trim();
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL?.trim();
const MPESA_TRANSACTION_TYPE = process.env.MPESA_TRANSACTION_TYPE?.trim() || "CustomerPayBillOnline";

const VALID_TRANSACTION_TYPES = new Set(["CustomerPayBillOnline", "CustomerBuyGoodsOnline"]);

export function getMpesaConfigInfo() {
  const isSandbox = MPESA_BASE_URL.includes("sandbox");
  const missing: string[] = [];
  if (!MPESA_CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
  if (!MPESA_CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
  if (!MPESA_SHORTCODE) missing.push("MPESA_SHORTCODE");
  if (!MPESA_PASSKEY) missing.push("MPESA_PASSKEY");
  if (!MPESA_CALLBACK_URL) missing.push("MPESA_CALLBACK_URL");

  let warning: string | null = null;
  if (!VALID_TRANSACTION_TYPES.has(MPESA_TRANSACTION_TYPE)) {
    warning = `Invalid MPESA_TRANSACTION_TYPE "${MPESA_TRANSACTION_TYPE}". Use CustomerBuyGoodsOnline (till) or CustomerPayBillOnline (paybill).`;
  } else if (process.env.NODE_ENV === "production" && isSandbox) {
    warning =
      "Production server is using M-Pesa SANDBOX. Set MPESA_BASE_URL=https://api.safaricom.co.ke and use production Daraja credentials.";
  } else if (isSandbox) {
    warning = "Sandbox mode — only Safaricom test numbers (e.g. 254708374149) receive STK prompts.";
  }

  return {
    environment: isSandbox ? "sandbox" : "production",
    baseUrl: MPESA_BASE_URL,
    shortcodeSuffix: MPESA_SHORTCODE ? MPESA_SHORTCODE.slice(-4) : null,
    transactionType: MPESA_TRANSACTION_TYPE,
    callbackUrl: MPESA_CALLBACK_URL ?? null,
    credentialsConfigured: missing.length === 0,
    missing,
    warning,
  };
}

export function validateMpesaConfig(): void {
  const info = getMpesaConfigInfo();

  if (info.missing.length > 0) {
    console.error(`M-Pesa config incomplete — missing: ${info.missing.join(", ")}`);
    return;
  }

  if (info.warning) {
    console.error(`M-Pesa config warning: ${info.warning}`);
    return;
  }

  console.log(
    `M-Pesa ready (${info.environment}) — shortcode ***${info.shortcodeSuffix}, type ${info.transactionType}`
  );
}

export interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface MpesaStkQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

const STK_FAILURE_MESSAGES: Record<number, string> = {
  1032: "You cancelled the M-Pesa prompt on your phone.",
  1037: "M-Pesa could not reach your phone. Check network signal, that the number is registered on M-Pesa, and try again.",
  1: "Insufficient M-Pesa balance. Top up and try again.",
  2001: "Wrong M-Pesa PIN entered.",
};

export function describeStkResult(resultCode: number, resultDesc?: string): string {
  const desc = resultDesc?.toLowerCase() ?? "";
  if (desc.includes("agent number") && desc.includes("store number")) {
    return (
      "Safaricom rejected the till configuration. On Render, MPESA_SHORTCODE and MPESA_PASSKEY must both come from the same Daraja Production app (Lipa na Mpesa Online). Remove any MPESA_TILL_NUMBER variable if you added one."
    );
  }
  return STK_FAILURE_MESSAGES[resultCode] || resultDesc || "M-Pesa payment was not completed.";
}

export function isLikelySandboxCheckoutId(checkoutRequestID: string): boolean {
  return /ws_CO_\d{14}\d{9,10}$/.test(checkoutRequestID);
}

export interface MpesaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

async function getAccessToken(): Promise<string> {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error("Missing MPESA consumer key or secret in environment variables.");
  }

  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const url = `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;

  try {
    const response = await axios.get<MpesaAccessTokenResponse>(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.data?.access_token) {
      throw new Error("Failed to obtain M-Pesa access token (empty response).");
    }

    return response.data.access_token;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const safaricomError = error.response?.data;
      console.error("Safaricom OAuth Error:", safaricomError || error.message);
      throw new Error(
        `M-Pesa Access Token error: ${safaricomError?.errorMessage || safaricomError?.message || error.message}`
      );
    }
    throw error;
  }
}

/** Daraja: PartyA and PhoneNumber must be MSISDN 254XXXXXXXXX (12 digits). */
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

  return `${getPart("year")}${getPart("month")}${getPart("day")}${getPart("hour")}${getPart("minute")}${getPart("second")}`;
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
  const mpesaInfo = getMpesaConfigInfo();
  if (process.env.NODE_ENV === "production" && mpesaInfo.environment === "sandbox") {
    throw new Error(
      "M-Pesa is misconfigured: this server is using the SANDBOX API. Set MPESA_BASE_URL=https://api.safaricom.co.ke on Render and use production Daraja credentials."
    );
  }

  if (!MPESA_SHORTCODE) {
    throw new Error("Missing MPESA_SHORTCODE — use the Lipa Na M-Pesa Online shortcode from your Daraja Production app.");
  }

  if (!VALID_TRANSACTION_TYPES.has(MPESA_TRANSACTION_TYPE)) {
    throw new Error(
      `Invalid MPESA_TRANSACTION_TYPE "${MPESA_TRANSACTION_TYPE}". Use CustomerBuyGoodsOnline for a till or CustomerPayBillOnline for a paybill.`
    );
  }

  const normalizedPhone = normalizePhoneNumber(params.phone);
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);
  const callbackUrl = params.callbackUrl?.trim() || MPESA_CALLBACK_URL;

  if (!callbackUrl) {
    throw new Error("Missing MPESA callback URL. Set MPESA_CALLBACK_URL in the environment.");
  }

  // Daraja Lipa Na M-Pesa Online: PartyB is the same shortcode as BusinessShortCode.
  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: MPESA_TRANSACTION_TYPE,
    Amount: Math.round(params.amount),
    PartyA: normalizedPhone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  console.log(
    `Initiating Daraja STK push — customer 254***${normalizedPhone.slice(-4)}, amount KES ${payload.Amount}, shortcode ***${MPESA_SHORTCODE.slice(-4)}, type ${MPESA_TRANSACTION_TYPE}`
  );

  try {
    const response = await axios.post<MpesaStkPushResponse>(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
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

    if (process.env.NODE_ENV === "production" && isLikelySandboxCheckoutId(data.CheckoutRequestID)) {
      throw new Error(
        "M-Pesa is still running in sandbox mode. On Render, set MPESA_BASE_URL=https://api.safaricom.co.ke and use production Daraja credentials."
      );
    }

    return data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const safaricomError = error.response?.data;
      console.error("Safaricom STK Push Error:", safaricomError || error.message);
      throw new Error(
        `M-Pesa STK Push error: ${safaricomError?.errorMessage || safaricomError?.message || error.message}`
      );
    }
    throw error;
  }
};

export const queryStkPushStatus = async (checkoutRequestID: string): Promise<MpesaStkQueryResponse> => {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);

  const response = await axios.post<MpesaStkQueryResponse>(
    `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
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
