import { createClient } from "@supabase/supabase-js";

const FLUTTERWAVE_VERIFY_URL =
  "https://api.flutterwave.com/v3/transactions";
const SUCCESSFUL_PAYMENT_STATUS = "successful";
const INITIAL_ORDER_STATUS = "processing";
const DEFAULT_CURRENCY = "NGN";
const UNPROVIDED_EMAIL = "Not provided";
const UNPROVIDED_CUSTOMER_NAME = "Not provided";
const UNPROVIDED_CUSTOMER_PHONE = "Not provided";
const UNPROVIDED_DELIVERY_ADDRESS = "Not provided";
const FALLBACK_PRODUCT_NAME = "Paid order";

type UnknownRecord = Record<string, unknown>;

export type OrderInput = {
  productName?: unknown;
  amount?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  deliveryAddress?: unknown;
  txRef?: unknown;
  currency?: unknown;
};

type FlutterwaveVerifyResponse = {
  status?: string;
  message?: string;
  data?: {
    id?: string | number;
    tx_ref?: string;
    flw_ref?: string;
    amount?: string | number;
    charged_amount?: string | number;
    currency?: string;
    status?: string;
    customer?: {
      name?: string | null;
      email?: string | null;
      phone_number?: string | null;
      phone?: string | null;
    };
    meta?: UnknownRecord | null;
    narration?: string | null;
  };
};

type NormalizedOrder = {
  product_name: string;
  amount: number;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  payment_status: string;
  transaction_id: string;
  order_status: string;
};

export type ProcessedOrderResult = {
  order: NormalizedOrder & {
    id: string;
    created_at?: string;
    assigned_vendor?: string | null;
  };
  created: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailError?: string;
};

export class OrderProcessingError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "OrderProcessingError";
    this.statusCode = statusCode;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new OrderProcessingError(
      "Missing Supabase server credentials. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getFlutterwaveSecretKey() {
  const secretKey =
    process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;

  if (!secretKey) {
    throw new OrderProcessingError(
      "Missing Flutterwave secret key. Add FLUTTERWAVE_SECRET_KEY to the server environment.",
      500
    );
  }

  return secretKey;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const stringValue = asString(value);
  return stringValue || undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getMetaString(meta: UnknownRecord | null | undefined, keys: string[]) {
  if (!meta) return undefined;

  for (const key of keys) {
    const value = asOptionalString(meta[key]);
    if (value) return value;
  }

  return undefined;
}

function getMetaNumber(meta: UnknownRecord | null | undefined, keys: string[]) {
  if (!meta) return undefined;

  for (const key of keys) {
    const value = asNumber(meta[key]);
    if (Number.isFinite(value)) return value;
  }

  return undefined;
}

function assertApproximatelyEqual(
  actual: number,
  expected: number,
  message: string
) {
  if (Math.abs(actual - expected) > 0.01) {
    throw new OrderProcessingError(message, 409);
  }
}

async function verifyFlutterwaveTransaction(transactionId: string) {
  const response = await fetch(
    `${FLUTTERWAVE_VERIFY_URL}/${encodeURIComponent(transactionId)}/verify`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
      },
    }
  );

  const result = (await response.json().catch(() => null)) as
    | FlutterwaveVerifyResponse
    | null;

  if (!response.ok || !result?.data) {
    throw new OrderProcessingError(
      result?.message || "Flutterwave transaction verification failed.",
      response.status || 502
    );
  }

  return result.data;
}

function normalizeVerifiedOrder(
  verifiedTransaction: NonNullable<FlutterwaveVerifyResponse["data"]>,
  fallback: OrderInput
): NormalizedOrder {
  const meta = verifiedTransaction.meta;
  const transactionId = String(verifiedTransaction.id || "").trim();
  const verifiedAmount = asNumber(verifiedTransaction.amount);
  const fallbackAmount = asNumber(fallback.amount);
  const metaAmount = getMetaNumber(meta, ["order_amount", "amount"]);
  const amount = isFiniteNumber(fallbackAmount)
    ? fallbackAmount
    : isFiniteNumber(metaAmount)
      ? metaAmount
      : verifiedAmount;
  const expectedTxRef =
    asOptionalString(fallback.txRef) || getMetaString(meta, ["tx_ref"]);
  const expectedCurrency =
    asOptionalString(fallback.currency) ||
    getMetaString(meta, ["currency"]) ||
    DEFAULT_CURRENCY;
  const paymentStatus = asString(verifiedTransaction.status).toLowerCase();
  const verifiedCurrency = asString(verifiedTransaction.currency).toUpperCase();

  if (!transactionId) {
    throw new OrderProcessingError("Flutterwave did not return a transaction id.", 422);
  }

  if (paymentStatus !== SUCCESSFUL_PAYMENT_STATUS) {
    throw new OrderProcessingError(
      `Flutterwave transaction is ${paymentStatus || "not successful"}.`,
      409
    );
  }

  if (verifiedCurrency !== expectedCurrency.toUpperCase()) {
    throw new OrderProcessingError("Flutterwave currency did not match the order.", 409);
  }

  if (expectedTxRef && verifiedTransaction.tx_ref !== expectedTxRef) {
    throw new OrderProcessingError(
      "Flutterwave transaction reference did not match the order.",
      409
    );
  }

  if (isFiniteNumber(amount) && isFiniteNumber(verifiedAmount)) {
    assertApproximatelyEqual(
      verifiedAmount,
      amount,
      "Flutterwave amount did not match the order."
    );
  }

  const customer = verifiedTransaction.customer;
  const productName =
    asOptionalString(fallback.productName) ||
    getMetaString(meta, ["product_name", "productName"]) ||
    asOptionalString(verifiedTransaction.narration) ||
    FALLBACK_PRODUCT_NAME;
  const customerName =
    asOptionalString(fallback.customerName) ||
    getMetaString(meta, ["customer_name", "customerName"]) ||
    asOptionalString(customer?.name) ||
    UNPROVIDED_CUSTOMER_NAME;
  const customerPhone =
    asOptionalString(fallback.customerPhone) ||
    getMetaString(meta, ["customer_phone", "customerPhone"]) ||
    asOptionalString(customer?.phone_number) ||
    asOptionalString(customer?.phone) ||
    UNPROVIDED_CUSTOMER_PHONE;
  const customerEmail =
    asOptionalString(fallback.customerEmail) ||
    getMetaString(meta, ["customer_email", "customerEmail"]) ||
    asOptionalString(customer?.email) ||
    UNPROVIDED_EMAIL;
  const deliveryAddress =
    asOptionalString(fallback.deliveryAddress) ||
    getMetaString(meta, ["delivery_address", "deliveryAddress"]) ||
    UNPROVIDED_DELIVERY_ADDRESS;

  if (!isFiniteNumber(amount) || amount <= 0) {
    throw new OrderProcessingError("The verified order is missing product details.", 422);
  }

  return {
    product_name: productName,
    amount,
    customer_email: customerEmail,
    customer_name: customerName,
    customer_phone: customerPhone,
    delivery_address: deliveryAddress,
    payment_status: SUCCESSFUL_PAYMENT_STATUS,
    transaction_id: transactionId,
    order_status: INITIAL_ORDER_STATUS,
  };
}

async function saveOrder(order: NormalizedOrder) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingOrder, error: findError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("transaction_id", order.transaction_id)
    .maybeSingle();

  if (findError) {
    throw new OrderProcessingError(findError.message, 500);
  }

  if (existingOrder) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        ...order,
        order_status: existingOrder.order_status || order.order_status,
        assigned_vendor: existingOrder.assigned_vendor,
      })
      .eq("id", existingOrder.id)
      .select("*")
      .single();

    if (error) {
      throw new OrderProcessingError(error.message, 500);
    }

    return { order: data, created: false };
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert([order])
    .select("*")
    .single();

  if (error) {
    throw new OrderProcessingError(error.message, 500);
  }

  return { order: data, created: true };
}

function renderOrderText(order: ProcessedOrderResult["order"]) {
  return [
    "A new Dolapo order was placed.",
    "",
    `Product: ${order.product_name}`,
    `Amount: NGN ${order.amount}`,
    `Customer: ${order.customer_name}`,
    `Email: ${order.customer_email}`,
    `Phone: ${order.customer_phone}`,
    `Address: ${order.delivery_address}`,
    `Transaction ID: ${order.transaction_id}`,
    `Status: ${order.order_status}`,
  ].join("\n");
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOrderHtml(order: ProcessedOrderResult["order"]) {
  const rows = [
    ["Product", order.product_name],
    ["Amount", `NGN ${order.amount}`],
    ["Customer", order.customer_name],
    ["Email", order.customer_email],
    ["Phone", order.customer_phone],
    ["Address", order.delivery_address],
    ["Transaction ID", order.transaction_id],
    ["Status", order.order_status],
  ];

  return `
    <div style="font-family: Arial, sans-serif; color: #17130b;">
      <h2 style="margin: 0 0 16px;">New Dolapo order</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="font-weight: 700; border-bottom: 1px solid #eee;">${label}</td>
                <td style="border-bottom: 1px solid #eee;">${escapeHtml(value)}</td>
              </tr>
            `
          )
          .join("")}
      </table>
    </div>
  `;
}

async function sendOrderNotification(order: ProcessedOrderResult["order"]) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL;

  if (!apiKey || !to) {
    return { sent: false, skipped: true };
  }

  const from =
    process.env.ORDER_NOTIFICATION_FROM || "Dolapo Orders <onboarding@resend.dev>";
  const recipients = to
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (!recipients.length) {
    return { sent: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `New Dolapo order: ${order.product_name}`,
      text: renderOrderText(order),
      html: renderOrderHtml(order),
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return {
      sent: false,
      skipped: false,
      error: message || "Order email could not be sent.",
    };
  }

  return { sent: true, skipped: false };
}

export async function processFlutterwaveOrder(
  transactionId: string,
  fallback: OrderInput = {}
): Promise<ProcessedOrderResult> {
  const verifiedTransaction = await verifyFlutterwaveTransaction(transactionId);
  const normalizedOrder = normalizeVerifiedOrder(verifiedTransaction, fallback);
  const savedOrder = await saveOrder(normalizedOrder);
  const emailResult = savedOrder.created
    ? await sendOrderNotification(savedOrder.order)
    : { sent: false, skipped: true };

  return {
    order: savedOrder.order,
    created: savedOrder.created,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped,
    emailError: "error" in emailResult ? emailResult.error : undefined,
  };
}
