FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install


COPY . .

EXPOSE 3000

RUN echo "Building frontend"
RUN yarn run build
CMD ["yarn", "serve", "-s", "build"]
