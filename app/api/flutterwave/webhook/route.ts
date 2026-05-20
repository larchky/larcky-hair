import { createHmac, timingSafeEqual } from "node:crypto";
import {
  OrderProcessingError,
  processFlutterwaveOrder,
  type OrderInput,
} from "@/lib/orderProcessing";

export const runtime = "nodejs";

type FlutterwaveWebhookPayload = {
  event?: string;
  "event.type"?: string;
  data?: {
    id?: string | number;
    transaction_id?: string | number;
    tx_ref?: string;
    amount?: string | number;
    currency?: string;
    status?: string;
    customer?: {
      name?: string | null;
      email?: string | null;
      phone_number?: string | null;
      phone?: string | null;
    };
    meta?: Record<string, unknown> | null;
  };
};

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function hasValidSignature(request: Request, rawBody: string) {
  const secretHash =
    process.env.FLW_SECRET_HASH || process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!secretHash) return true;

  const plainHash =
    request.headers.get("verif-hash") ||
    request.headers.get("verifi-hash") ||
    request.headers.get("verify-hash");

  if (plainHash && safeCompare(plainHash, secretHash)) {
    return true;
  }

  const hmacSignature = request.headers.get("flutterwave-signature");

  if (!hmacSignature) return false;

  const expectedSignature = createHmac("sha256", secretHash)
    .update(rawBody)
    .digest("base64");

  return safeCompare(hmacSignature, expectedSignature);
}

function getWebhookTransactionId(data: FlutterwaveWebhookPayload["data"]) {
  const value = data?.id || data?.transaction_id;
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getOrderFallback(
  data: FlutterwaveWebhookPayload["data"]
): OrderInput {
  const meta = data?.meta || {};

  return {
    productName: meta.product_name || meta.productName,
    amount: data?.amount || meta.order_amount || meta.amount,
    customerName:
      meta.customer_name || meta.customerName || data?.customer?.name,
    customerPhone:
      meta.customer_phone ||
      meta.customerPhone ||
      data?.customer?.phone_number ||
      data?.customer?.phone,
    customerEmail:
      meta.customer_email || meta.customerEmail || data?.customer?.email,
    deliveryAddress: meta.delivery_address || meta.deliveryAddress,
    txRef: data?.tx_ref || meta.tx_ref,
    currency: data?.currency || meta.currency,
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!hasValidSignature(request, rawBody)) {
    return Response.json({ error: "Invalid Flutterwave signature." }, { status: 401 });
  }

  let payload: FlutterwaveWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const data = payload.data;
  const eventName = payload.event || payload["event.type"] || "";
  const status = String(data?.status || "").toLowerCase();

  if (eventName && eventName !== "charge.completed") {
    return Response.json({ received: true, skipped: true });
  }

  if (status && status !== "successful") {
    return Response.json({ received: true, skipped: true });
  }

  const transactionId = getWebhookTransactionId(data);

  if (!transactionId) {
    return Response.json(
      { received: true, skipped: true, error: "Missing transaction id." },
      { status: 200 }
    );
  }

  try {
    const result = await processFlutterwaveOrder(
      transactionId,
      getOrderFallback(data)
    );

    return Response.json({
      received: true,
      order: result.order,
      created: result.created,
      emailSent: result.emailSent,
      emailSkipped: result.emailSkipped,
      emailError: result.emailError,
    });
  } catch (error) {
    const statusCode =
      error instanceof OrderProcessingError && error.statusCode >= 500
        ? error.statusCode
        : 200;

    return Response.json(
      {
        received: true,
        processed: false,
        error:
          error instanceof Error ? error.message : "Could not process webhook.",
      },
      { status: statusCode }
    );
  }
}
