import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { prisma } from './lib/prisma.js';
import { startJobs } from './jobs/cleanup.js';

const app = createApp();
const httpServer = createServer(app);
initSocket(httpServer);

startJobs(); // libera asientos vencidos y cancela reservas impagas

httpServer.listen(env.PORT, () => {
  console.log(`🚌 JC Transporte API escuchando en http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando…`);
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
