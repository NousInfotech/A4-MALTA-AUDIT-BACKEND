FROM node:20

# Install system deps
RUN apt-get update \
  && apt-get install -y poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "start"]
