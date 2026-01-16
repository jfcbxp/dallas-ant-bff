FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ linux-headers eudev-dev

ENV CXXFLAGS="-std=c++17"

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

COPY prisma ./prisma
COPY src ./src
COPY .env.* ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./
RUN yarn prisma generate
RUN yarn build

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN apk add --no-cache eudev-libs

COPY package.json yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./dist/generated
COPY --from=builder /app/prisma ./prisma
COPY .env.* ./
COPY --from=builder /app/dist/main.js ./dist/server.js

EXPOSE 8080

CMD ["node", "dist/server.js"]
