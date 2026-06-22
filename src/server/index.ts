import { config } from "./config.js";
import "./db/client.js";
import { buildApp } from "./app.js";
import { startWorker, stopWorker } from "./worker.js";

const app = await buildApp();

if (!config.workerDisabled) {
  startWorker();
}

const close = async () => {
  stopWorker();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());

await app.listen({ host: config.apiHost, port: config.apiPort });
