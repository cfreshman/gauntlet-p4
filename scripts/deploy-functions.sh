#!/bin/bash

# Load environment variables from correct .env file
set -a
if [ "$NODE_ENV" = "production" ]; then
  source .env.production
  cp supabase/config.production.toml supabase/config.toml
else
  source .env.development
  cp supabase/config.development.toml supabase/config.toml
fi
set +a

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: Missing required environment variables"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $VITE_SUPABASE_URL | awk -F'.' '{print $1}' | awk -F'//' '{print $2}')

echo "Deploying Edge Functions for ${NODE_ENV:-development}..."

# Deploy function directly to project
echo "Deploying functions..."
supabase functions deploy plan-session --project-ref $PROJECT_REF

# Set OpenAI key as secret
echo "Setting OpenAI API key..."
supabase secrets set --project-ref $PROJECT_REF OPENAI_API_KEY=$OPENAI_API_KEY

# Cleanup
rm supabase/config.toml

echo "Deployment complete!" 