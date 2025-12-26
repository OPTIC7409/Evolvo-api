/**
 * Prisma Client Singleton
 * 
 * This file creates a single instance of Prisma Client that can be
 * imported throughout the application. In development, it prevents
 * creating multiple instances due to hot reloading.
 */

import { PrismaClient } from "@prisma/client";

// Declare global type for Prisma in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create Prisma instance
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
  });
};

// Use global instance in development to prevent multiple connections
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export { prisma };
export default prisma;
