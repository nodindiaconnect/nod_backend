import prisma from "./config/prismaClient.js";

console.log("contactLead exists:", prisma.contactLead !== undefined);
console.log("contactLead:", prisma.contactLead);

await prisma.$connect();

console.log("Database connected");

await prisma.$disconnect();