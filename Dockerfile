FROM node:18.13.0-alpine AS base
WORKDIR /app
COPY index.js ./
COPY src/ ./src/
COPY package*.json ./
RUN npm ci

FROM node:18.13.0-alpine AS final
WORKDIR /app
COPY --from=base /app .
ENV NODE_ENV="production" \
    server_port="5005"
EXPOSE 5005
CMD ["node", "--experimental-specifier-resolution=node", "index.js"]