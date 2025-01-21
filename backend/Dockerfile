FROM oven/bun:1

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN bun install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN bunx prisma generate

# Copy source code
COPY . .

EXPOSE 4000
CMD ["bun", "start"]
