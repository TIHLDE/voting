FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY ./package.json ./yarn.lock ./
RUN yarn install
COPY ./prisma/schema.prisma ./prisma/
COPY . .
RUN yarn prisma generate
RUN yarn run build
RUN echo "done building"

EXPOSE 4000
CMD ["yarn", "start:migrate:prod"]
