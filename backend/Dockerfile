FROM node:20-alpine

WORKDIR /app

# Copy backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Generate Prisma client
COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate

# Copy source
COPY backend/src ./backend/src
COPY backend/public ./backend/public

WORKDIR /app/backend

EXPOSE 3000
CMD ["sh", "-c", "node prisma/migrate.js && node prisma/seed.js && node src/index.js"]
