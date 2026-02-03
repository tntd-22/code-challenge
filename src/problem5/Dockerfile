# Base stage
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm install
COPY . .
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY openapi.yaml ./
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
