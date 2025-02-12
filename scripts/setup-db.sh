#!/bin/bash

# Load environment variables from .env
set -a
source .env
set +a

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "Error: Missing Supabase environment variables"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $VITE_SUPABASE_URL | awk -F'.' '{print $1}' | awk -F'//' '{print $2}')

# Check if DB password is set
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo "Error: Missing database password. Set SUPABASE_DB_PASSWORD in .env"
    exit 1
fi

echo "Running initial setup..."

# Link project
echo "Linking project..."
supabase link --project-ref $PROJECT_REF --password $SUPABASE_DB_PASSWORD

# Reset database (this will run all migrations in order)
echo "Resetting database..."
supabase db reset

echo "Setup complete!" 