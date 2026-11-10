/** The path BASE_URL serves the site under, without the trailing '/' ('' at the root, '/webcgal' on GitHub Pages). */
export const BASE_PATH = new URL(process.env.BASE_URL ?? 'http://localhost:4173').pathname.replace(/\/$/, '')
