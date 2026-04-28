FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN test -x node_modules/.bin/codex

COPY . .

ENV NODE_ENV=production

EXPOSE 3000 5173

CMD ["npm", "run", "start:api"]
