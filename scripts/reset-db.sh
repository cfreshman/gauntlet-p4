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

echo "Running database reset..."

# Link to Supabase project
echo "Linking to Supabase project..."
supabase link --project-ref $PROJECT_REF --password $SUPABASE_DB_PASSWORD

# Mark all migrations as reverted
echo "Repairing migration history..."
supabase migration repair --status reverted 0000

# Push our schema
echo "Pushing schema..."
supabase db push

echo "Reset complete!" 