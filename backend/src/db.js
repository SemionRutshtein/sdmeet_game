const { PrismaClient } = require('@prisma/client');

// One client for the whole process.
const prisma = new PrismaClient();

module.exports = prisma;
