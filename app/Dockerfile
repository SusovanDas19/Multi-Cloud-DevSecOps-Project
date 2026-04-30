# Stage 1: Build the TypeScript code
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install
COPY src ./src
COPY public ./public
RUN npx tsc

# Stage 2: Run the compiled application
FROM node:20-alpine
WORKDIR /usr/src/app
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache --upgrade --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main libcrypto3 libssl3
COPY package*.json ./
RUN npm install --production
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public

EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
