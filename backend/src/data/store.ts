// Admin login is a single shared credential from env vars rather than a per-user
// password in the database - there is no password field on the User model.
export const seedCredentials = { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@eclabs.co', password: process.env.SEED_ADMIN_PASSWORD ?? 'ECLabs@2026' }
