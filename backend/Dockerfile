FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --break-system-packages --no-cache-dir pandas openpyxl

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8000

CMD ["npm", "start"]
