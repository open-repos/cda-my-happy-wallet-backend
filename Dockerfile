FROM node:16-bullseye

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run prisma:generate && npm run build

EXPOSE 4200

CMD ["bash", "-lc", "npm run db:deploy && npm start"]
