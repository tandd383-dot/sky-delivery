FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 3000
ENV UPLOADS_DIR=/app/uploads
ENV NODE_ENV=production
CMD ["node", "server.js"]
