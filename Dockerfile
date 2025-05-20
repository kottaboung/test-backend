FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps

# ✅ Copy prisma schema BEFORE running `prisma generate`
COPY prisma ./prisma

# ✅ Run prisma generate after schema is available
RUN npx prisma generate

# Copy the rest of your app
COPY . .

CMD npx prisma migrate deploy && npm run start:dev
