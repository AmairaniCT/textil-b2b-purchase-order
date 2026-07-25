FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Ojo: Para 'prisma generate' suele requerirse devDependencies o prisma CLI en dependencies.
# Si tu package.json tiene Prisma en devDependencies, instala primero completo para el build:
RUN npm install

COPY . .

# 1. Generar cliente de Prisma y compilar la aplicación
RUN npx prisma generate
RUN npm run build

# Limpiar cache de npm para reducir tamaño de imagen
RUN npm cache clean --force

# 2. Ejecutar las migraciones pendientes en BD y luego iniciar la app
CMD ["sh", "-c", "npx prisma migrate deploy && npm run docker-start"]