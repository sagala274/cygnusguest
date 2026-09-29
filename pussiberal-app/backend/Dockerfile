FROM node:20-alpine
RUN apk add --no-cache mysql-client
WORKDIR /app
# NODE_ENV=production mematikan perilaku "development" bawaan Express
# (pesan error lebih verbose, dst.) -- praktik baku untuk deployment produksi.
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
