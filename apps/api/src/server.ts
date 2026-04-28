import Fastify from "fastify";
import { createForgeTask, transitionTask } from "../../../packages/core/src/index.js";

export function buildServer() {
  const server = Fastify({ logger: true });

  server.get("/health", async () => ({
    ok: true,
    service: "auto-forge-api"
  }));

  server.post<{
    Body: {
      id: string;
      repoId: string;
      requestedByUserId: string;
      title: string;
    };
  }>("/tasks", async (request, reply) => {
    const task = createForgeTask(request.body);
    return reply.code(201).send(transitionTask(task, { type: "enqueue" }));
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await server.listen({ host: "0.0.0.0", port });
}
