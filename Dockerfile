# Étape 1 : construction du site statique
FROM node:22-alpine AS build
WORKDIR /app
ARG SITE_URL=http://localhost:8080
ENV SITE_URL=$SITE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# Calcule les empreintes des scripts inline et les injecte dans la CSP
COPY nginx.conf /tmp/nginx.conf
RUN node scripts/inject-csp.mjs /tmp/nginx.conf dist /tmp/default.conf

# Étape 2 : Nginx ne sert que dist/ et la config
FROM nginx:alpine
COPY --from=build /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
