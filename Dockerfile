# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

  # ---- Dependencies ----
FROM base AS dependencies
RUN npm ci --omit=dev

  # ---- Build ----
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

  # ---- Release ----
FROM base AS release
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package.json .
COPY secrets ./secrets

EXPOSE 3000
  
CMD ["node", "dist/main"]
