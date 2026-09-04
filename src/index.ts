/**
 * Application entry point: small Express server that serves the web UI
 * (static files in `public/`) and the JSON API in `src/http/api.ts`.
 *
 * Start with `npm run dev` (watch mode) or `npm start`.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { HOST, PORT } from './config.js';
import { apiRouter } from './http/api.js';
import { createOrderGenerator } from './generators/createOrder/index.js';
import { registerGenerator } from './generators/registry.js';

// Register the generators supported by this build.
registerGenerator(createOrderGenerator);

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);
app.use(express.static(publicDir, { extensions: ['html'] }));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  console.error('[sterling-data-generator]', error);
  res.status(500).json({ error: { message } });
});

app.listen(PORT, HOST, () => {
  console.log(`Sterling sample data generator listening on http://${HOST}:${PORT}`);
  console.log(`Serving static UI from ${path.relative(process.cwd(), publicDir) || 'public'}`);
});
