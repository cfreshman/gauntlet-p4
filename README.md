# Gomodoro

AI-enhanced Pomodoro timer for focused productivity. A fork of [Tomodoro](https://github.com/lazy-guy/tomodoro) with cloud sync and AI features.

## Environment Setup

1. Copy `.env.example` to create new environment files:
   ```bash
   cp .env.example .env.development
   cp .env.example .env.production
   ```

2. Update the environment files with your Supabase credentials:
   - `.env.development` - Development environment (local)
   - `.env.production` - Production environment (deployed)

   Never commit these files to version control!

3. Required environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_DB_PASSWORD` - Database password for migrations

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Database Management

```bash
# Push schema changes to development
npm run db:push:dev

# Push schema changes to production
npm run db:push:prod

# Seed development database
npm run db:seed
``` 