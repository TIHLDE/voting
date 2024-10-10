FROM node:22-alpine

WORKDIR /src

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 3000

