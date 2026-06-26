import { Request, Response } from "express";
import { Order } from "../models/Order";
import {
  queueOrderConfirmationEmail,
  queueOrderPaymentReminderEmail,
  queueOrderShippedNotificationEmail,
  queueOrderDeliveredNotificationEmail,
  queueAdminNotification,
} from "../utils/emailJobs";
import { generateOrderNumber } from "../utils/helpers";
import { initiateStkPush, parseStkCallback, generateReference } from "../utils/mpesa";
import { renderAdminNotification } from "../utils/emailTemplates";
import { z } from "zod";


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
  mpesaPhone: z.string().min(9).optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1),
  courier: z.string().default("Swatin"),
  notes: z.string().optional(),
});

// ─── Controllers ───────────────────────────────────────────────────────────────

/** POST /api/orders — Create order & initialize M-Pesa STK Push */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten() });
      return;
    }

    const { customer, mpesaPhone, items, courier, notes } = parsed.data;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deliveryFee = 0; // can add courier-based logic later
    const total = subtotal + deliveryFee;

    const orderNumber = generateOrderNumber();
    const mpesaRef = generateReference(orderNumber);

    const storedCustomer = {
      name: customer.name,
      phone: customer.phone,
      ...(customer.email ? { email: customer.email } : {}),
      city: customer.city,
      address: customer.address,
    };

    const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();
    if (!callbackUrl) {
      res.status(500).json({ success: false, message: "M-Pesa callback URL is not configured." });
      return;
    }

    let mpesaRes;
    try {
      mpesaRes = await initiateStkPush({
        amount: total,
        phone: mpesaPhone || customer.phone,
        accountReference: orderNumber,
        transactionDesc: `Payment for D-Daily order ${orderNumber}`,
        callbackUrl,
      });
    } catch (mpesaErr) {
      console.error("M-Pesa STK push initiation failed:", mpesaErr);
      res.status(502).json({
        success: false,
        message: mpesaErr instanceof Error ? mpesaErr.message : "M-Pesa STK push could not be initiated.",
      });
      return;
    }

    const order = await Order.create({
      orderNumber,
      customer: storedCustomer,
      items,
      subtotal,
      deliveryFee,
      total,
      courier,
      notes,
      status: "pending_payment",
      payment: {
        provider: "mpesa",
        reference: mpesaRef,
        checkoutRequestID: mpesaRes.CheckoutRequestID,
        merchantRequestID: mpesaRes.MerchantRequestID,
        customerPhone: mpesaPhone || customer.phone,
      },
    });

    if (customer.email) {
      queueOrderConfirmationEmail(customer.email, order).catch((err) => {
        console.error("Error queueing pending order confirmation email:", err);
      });
    }

    const adminSubject = order.status === "pending_payment"
      ? `New pending payment order: ${order.orderNumber}`
      : `New order: ${order.orderNumber}`;

    queueAdminNotification(
      adminSubject,
      renderAdminNotification("order", { ...order.toObject?.() ?? order, status: order.status })
    ).catch((err) => {
      console.error("Failed to queue admin notification for new order:", err);
    });

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
          reference: mpesaRef,
          checkoutRequestID: mpesaRes.CheckoutRequestID,
          merchantRequestID: mpesaRes.MerchantRequestID,
          message: mpesaRes.CustomerMessage,
          customerPhone: mpesaPhone || customer.phone,
        },
      },
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

/** GET /api/orders/verify/:reference — Verify order payment status */
export const verifyOrder = async (req: Request<{ reference: string }>, res: Response): Promise<void> => {
  try {
    const referenceParam = req.params.reference;
    const reference = Array.isArray(referenceParam) ? referenceParam[0] : referenceParam;

    const order = await Order.findOne({ "payment.reference": reference });
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
        paidAt: order.payment?.paidAt,
        customerPhone: order.payment?.customerPhone || order.customer?.phone || null,
      },
    });
  } catch (err) {
    console.error("Verify order error:", err);
    res.status(500).json({ success: false, message: "Failed to verify payment status" });
  }
};

/** POST /api/orders/webhook — M-Pesa webhook handler */
export const mpesaWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== "object" || !req.body.Body?.stkCallback) {
      console.warn("M-Pesa webhook received invalid or unexpected payload:", req.body);
      res.status(200).json({ success: false, message: "Invalid M-Pesa callback payload ignored." });
      return;
    }

    const callbackPayload = parseStkCallback(req.body);

    if (callbackPayload.resultCode !== 0) {
      console.warn("M-Pesa STK callback returned non-zero result code:", callbackPayload);
      res.sendStatus(200);
      return;
    }

    const order = await Order.findOneAndUpdate(
      { "payment.checkoutRequestID": callbackPayload.checkoutRequestID, status: { $ne: "paid" } },
      {
        $set: {
          status: "paid",
          "payment.paidAt": new Date(),
          "payment.channel": "mpesa",
          "payment.merchantRequestID": callbackPayload.merchantRequestID,
          "payment.receiptNumber": callbackPayload.receiptNumber,
          "payment.amount": callbackPayload.amount,
          "payment.phoneNumber": callbackPayload.phoneNumber,
        },
      },
      { new: true }
    );

    if (!order) {
      console.warn("M-Pesa webhook callback received for unknown or already-paid checkoutRequestID:", callbackPayload.checkoutRequestID);
      res.sendStatus(200);
      return;
    }

    if (order.customer?.email) {
      queueOrderConfirmationEmail(order.customer.email, order).catch((err) => {
        console.error("Error queueing webhook-paid confirmation email:", err);
      });
    }

    queueAdminNotification(
      `Order paid — ${order.orderNumber}`,
      renderAdminNotification("order", { ...order.toObject?.() ?? order, status: order.status })
    ).catch((err) => {
      console.error("Failed to queue admin notification for webhook-paid order:", err);
    });

    res.sendStatus(200);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid M-Pesa callback payload")) {
      console.warn("M-Pesa webhook ignored invalid payload:", err.message);
      res.status(200).json({ success: false, message: "Invalid M-Pesa callback payload ignored." });
      return;
    }

    console.error("M-Pesa webhook error:", err);
    res.status(500).json({ success: false, message: "Internal webhook error" });
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

/** DELETE /api/admin/orders/:orderNumber  [admin] */
export const deleteOrder = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "pending_payment") {
      res.status(400).json({ success: false, message: "Only pending payment orders can be deleted." });
      return;
    }

    await Order.deleteOne({ orderNumber });
    res.json({ success: true, message: "Pending order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ success: false, message: "Failed to delete order" });
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

// Payment reminders do not require a retry URL for M-Pesa. Reminders are sent via email with order details and next steps.

export const sendOrderPaymentReminder = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (order.status !== "pending_payment") {
      res.status(400).json({ success: false, message: "Payment reminders can only be sent for pending payment orders" });
      return;
    }

    const to = order.customer?.email;
    if (!to) {
      res.status(400).json({ success: false, message: "Customer email is required to send a payment reminder" });
      return;
    }

    await queueOrderPaymentReminderEmail(to, order, order.payment?.authorizationUrl);
    res.json({ success: true, message: "Payment reminder email sent" });
  } catch (err) {
    console.error("Payment reminder error:", err);
    res.status(500).json({ success: false, message: "Failed to send payment reminder" });
  }
};

export const sendOrderShippedNotification = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (!order.customer?.email) {
      res.status(400).json({ success: false, message: "Customer email is required to send shipment notification" });
      return;
    }

    await queueOrderShippedNotificationEmail(order.customer.email, order);
    res.json({ success: true, message: "Shipped notification email sent" });
  } catch (err) {
    console.error("Shipped notification error:", err);
    res.status(500).json({ success: false, message: "Failed to send shipped notification" });
  }
};

export const sendOrderDeliveredNotification = async (req: Request<{ orderNumber: string }>, res: Response): Promise<void> => {
  try {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    if (!order.customer?.email) {
      res.status(400).json({ success: false, message: "Customer email is required to send delivery notification" });
      return;
    }

    await queueOrderDeliveredNotificationEmail(order.customer.email, order);
    res.json({ success: true, message: "Delivery notification email sent" });
  } catch (err) {
    console.error("Delivery notification error:", err);
    res.status(500).json({ success: false, message: "Failed to send delivery notification" });
  }
};
