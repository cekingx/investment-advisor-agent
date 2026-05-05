FROM node:24-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --force

FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --force
COPY . .
RUN npm run build

FROM node:24-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
