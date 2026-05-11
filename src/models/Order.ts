import mongoose, { Document, Schema } from "mongoose";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface IOrderItem {
  slug: string;
  name: string;
  price: number;
  qty: number;
  image: string;
}

export interface ICustomer {
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  customer: ICustomer;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  courier: string;
  status: OrderStatus;
  payment: {
    provider: "paystack";
    reference?: string;
    paystackRef?: string;
    paidAt?: Date;
    channel?: string; // card, mobile_money, bank_transfer
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String },
      city: { type: String, required: true },
      address: { type: String, required: true },
    },
    items: [
      {
        slug: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
        image: { type: String, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    courier: { type: String, default: "Swatin" },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending_payment",
    },
    payment: {
      provider: { type: String, default: "paystack" },
      reference: { type: String },
      paystackRef: { type: String },
      paidAt: { type: Date },
      channel: { type: String },
    },
    notes: { type: String },
  },
  { timestamps: true }
);

OrderSchema.index({ "customer.phone": 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ "payment.reference": 1 });

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
