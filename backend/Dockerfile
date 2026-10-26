FROM node:20-alpine

WORKDIR /app

#Enable pnpm
RUN corepack enable

# Install deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

#Copy source code
COPY . .

# exposing the port as decided
EXPOSE 5000

# finally start !!
CMD ["pnpm","start"]
