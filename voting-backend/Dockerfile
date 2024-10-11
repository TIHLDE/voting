FROM node:22-alpine
WORKDIR /app
COPY ./package.json ./yarn.lock ./
RUN yarn install
COPY ./prisma/schema.prisma ./prisma/
COPY . .
RUN yarn run build
RUN echo "done building"

EXPOSE 4000
CMD ["yarn", "start:migrate:prod"]
