FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json

RUN npm ci

COPY . .

RUN npm run build:frontend

FROM nginx:1.27-alpine AS runtime

COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

