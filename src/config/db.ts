import mongoose from "mongoose";
import dns from "dns";

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not defined in environment variables");

  // Fix Node.js SRV lookups for MongoDB Atlas on some Windows/network setups
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};
