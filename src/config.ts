/** Runtime configuration. Everything has a sensible default, no .env required. */

export const PORT = Number(process.env.PORT ?? 3000);

/** Bind on all interfaces so the app works inside containers and preview environments. */
export const HOST = process.env.HOST ?? '0.0.0.0';
