import type { Plugin } from "vite";

export function viteApiPlugin(): Plugin {
  return {
    name: "learncache-api",
    configureServer(server) {
      const apiReady = (async () => {
        await import("./db/client.js");
        const { buildApp } = await import("./app.js");
        const { startWorker } = await import("./worker.js");
        const app = await buildApp();
        await app.ready();
        startWorker();
        return app;
      })();

      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api")) {
          next();
          return;
        }

        apiReady
          .then((app) => {
            app.server.emit("request", request, response);
          })
          .catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          });
      });

      server.httpServer?.once("close", () => {
        void Promise.all([import("./worker.js"), apiReady])
          .then(([worker, app]) => {
            worker.stopWorker();
            return app.close();
          })
          .catch(() => undefined);
      });
    }
  };
}
