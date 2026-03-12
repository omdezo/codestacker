FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and prisma schema before npm ci
# (postinstall runs `prisma generate` which needs the schema)
COPY package*.json ./
COPY prisma ./prisma

# Install all deps (dev included: prisma CLI + tsc are devDependencies)
RUN npm ci

# Copy remaining source
COPY . .

# Re-generate Prisma client for the target platform (Alpine)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads/id-images uploads/attachments

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
