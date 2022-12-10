FROM 721127801956.dkr.ecr.us-east-2.amazonaws.com/nls:latest as nls
FROM node:16

COPY --from=nls /usr/local/bin/nls /usr/local/bin/nls

WORKDIR /app

COPY src src
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .
COPY webpack.config.js .

RUN npm install

CMD ["npm", "run", "start"]
