FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
RUN test -x node_modules/.bin/codex

COPY . .

ENV NODE_ENV=production

EXPOSE 3000 5173

CMD ["npm", "run", "start:api"]
