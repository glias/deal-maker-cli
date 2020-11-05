FROM node:12.19.0

WORKDIR /usr/app

VOLUME /user/app/.db

COPY package*.json .

RUN npm install

COPY . .

RUN mv ormconfig.yml.example ormconfig.yml

RUN mv .env.example .env

EXPOSE 8114
