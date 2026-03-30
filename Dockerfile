FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p /app/data/uploads
EXPOSE 3000
ENV DATA_DIR=/app/data
ENV NODE_ENV=production
CMD ["node", "server.js"]
