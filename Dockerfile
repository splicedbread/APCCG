FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN --mount=type=secret,id=hmt ln -s /run/secrets/hmt /app/hmt.json && make
RUN rm hmt.json
ENTRYPOINT [ "node", "index.js" ]