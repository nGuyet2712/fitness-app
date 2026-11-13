FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

ENTRYPOINT ["sh", "-c", "if [ \"${NODE_ENV:-local}\" = local ]; then exec sh scripts/local-entrypoint.sh; else exec \"$@\"; fi", "sh"]

CMD ["node", "dist/main"]