FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY game.mjs server.mjs ./
COPY public ./public
USER node
EXPOSE 3780
CMD ["node", "server.mjs"]
