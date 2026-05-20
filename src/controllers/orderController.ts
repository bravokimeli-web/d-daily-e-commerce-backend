import { Request, Response } from "express";
import { Order } from "../models/Order";
import { sendOrderConfirmation } from "../utils/email";
import { generateOrderNumber } from "../utils/helpers";
import { initializePayment, verifyPayment, generateReference } from "../utils/paystack";
import { z } from "zod";
import crypto from "crypto";

// ─── Validation schemas ────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  price: z.number().positive(),
  qty: z.number().int().min(1),
  image: z.string(),
});

const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(9),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().min(1),
    address: z.string().min(1),
  }),
  items: z.array(orderItemSchema).min(1),
  courier: z.string().default("Swatin"),
  notes: z.string().optional(),
});

// ─── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/orders — Create order & initialize Paystack payment */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten() });
      return;
    }

    const { customer, items, courier, notes } = parsed.data;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deliveryFee = 0; // can add courier-based logic later
    const total = subtotal + deliveryFee;

    const orderNumber = generateOrderNumber();
    const paystackRef = generateReference(orderNumber);

    // Create order in DB (pending_payment)
    const order = await Order.create({
      orderNumber,
      customer: {
        ...customer,
        email: customer.email || undefined,
      },
      items,
      subtotal,
      deliveryFee,
      total,
      courier,
      notes,
      status: "pending_payment",
      payment: {
        provider: "paystack",
        reference: paystackRef,
      },
    });

    // Initialize Paystack transaction
    const callbackUrl = `${process.env.FRONTEND_URL}/checkout/verify?ref=${paystackRef}`;
    const email = customer.email || `${customer.phone.replace(/\s/g, "")}@ddaily.co.ke`;

    const paystackRes = await initializePayment({
      email,
      amount: total,
      reference: paystackRef,
      currency: "KES",
      callbackUrl,
      metadata: {
        orderNumber,
        customerName: customer.name,
        customerPhone: customer.phone,
      },
    });

    // Send order confirmation email (if email provided)
    try {
      if (customer.email) {
        const paymentUrl = paystackRes?.data?.authorization_url;
        await sendOrderConfirmation(customer.email, order, paymentUrl);
      }
    } catch (err) {
      console.error("Error sending order confirmation email:", err);
    }

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
        },
        payment: {
          authorizationUrl: paystackRes.data.authorization_url,
          reference: paystackRef,
          accessCode: paystackRes.data.access_code,
        },
      },
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

/** GET /api/orders/verify/:reference — Verify Paystack payment after redirect */
export const verifyOrder = async (req: Request<{ reference: string }>, res: Response): Promise<void> => {
  try {
    const referenceParam = req.params.reference;
    const reference = Array.isArray(referenceParam) ? referenceParam[0] : referenceParam;

    const verification = await verifyPayment(reference);

    if (!verification.data || verification.data.status !== "success") {
      res.status(400).json({
        success: false,
        message: "Payment not successful",
        paymentStatus: verification.data?.status,
      });
      return;
    }

    // Update order status to paid
    const order = await Order.findOneAndUpdate(
      { "payment.reference": reference },
      {
        $set: {
          status: "paid",
          "payment.paidAt": new Date(verification.data.paid_at),
          "payment.channel": verification.data.channel,
          "payment.paystackRef": verification.data.reference,
        },
      },
      { new: true }
    );

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found for this reference" });
      return;
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        paidAt: order.payment.paidAt,
      },
    });
  } catch (err) {
    console.error("Verify order error:", err);
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
};

/** POST /api/orders/webhook — Paystack webhook handler */
export const paystackWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signatureHeader = req.headers["x-paystack-signature"];
    const secret = process.env.PAYSTACK_SECRET_KEY as string;
    const rawBody = req.body as Buffer;

    if (!signatureHeader || typeof signatureHeader !== "string") {
      res.status(400).json({ message: "Missing Paystack signature" });
      return;
    }

    if (!secret) {
      res.status(500).json({ message: "Paystack secret not configured" });
      return;
    }

    const computedHash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    const actualSignature = Buffer.from(signatureHeader, "utf8");
    const expectedSignature = Buffer.from(computedHash, "utf8");

    if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
      res.status(401).json({ message: "Invalid signature" });
      return;
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const { event, data } = payload;

    if (event === "charge.success") {
      await Order.findOneAndUpdate(
        { "payment.reference": data.reference },
        {
          $set: {
            status: "paid",
            "payment.paidAt": new Date(data.paid_at),
            "payment.channel": data.channel,
            "payment.paystackRef": data.reference,
          },
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
};

/** GET /api/orders/:orderNumber  [admin or customer self-lookup] */
export const getOrder = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
};

/** GET /api/admin/orders  [admin] */
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const statusQuery = req.query.status as string | string[] | undefined;
    const pageQuery = req.query.page as string | string[] | undefined;
    const limitQuery = req.query.limit as string | string[] | undefined;

    const status = Array.isArray(statusQuery)
      ? statusQuery[0]
      : typeof statusQuery === "string"
      ? statusQuery
      : undefined;

    const page = Array.isArray(pageQuery)
      ? pageQuery[0]
      : typeof pageQuery === "string"
      ? pageQuery
      : "1";

    const limit = Array.isArray(limitQuery)
      ? limitQuery[0]
      : typeof limitQuery === "string"
      ? limitQuery
      : "20";

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const skip = (pageNumber - 1) * limitNumber;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

/** PATCH /api/admin/orders/:orderNumber/status  [admin] */
export const updateOrderStatus = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const validStatuses = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
    const { status } = req.body;

    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOneAndUpdate(
      { orderNumber },
      { $set: { status } },
      { new: true }
    );

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update order status" });
  }
};
