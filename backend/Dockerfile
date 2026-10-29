FROM node:22-alpine

WORKDIR /app

#Enable pnpm
RUN corepack enable

# Install deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

#Copy source code
COPY . .

ENV NODE_ENV=production
ENV BIND_HOST=0.0.0.0
USER node

# exposing the port as decided
EXPOSE 5000

# finally start !!
CMD ["pnpm","start"]
