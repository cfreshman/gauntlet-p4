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
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Error: Missing required environment variables"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $VITE_SUPABASE_URL | awk -F'.' '{print $1}' | awk -F'//' '{print $2}')

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "🚀 Deploying Edge Functions for ${GREEN}${NODE_ENV:-development}${NC}..."

# Array of functions to deploy
functions=(
    "search-sessions"
    "generate-embeddings"
    "ai-companion"
    "plan-session"
)

# Track overall success
success=true

# Deploy functions
echo -e "\nDeploying functions..."
for func in "${functions[@]}"; do
    echo -e "\n📦 Deploying ${GREEN}$func${NC}..."
    if supabase functions deploy "$func" --project-ref $PROJECT_REF; then
        echo -e "✅ ${GREEN}Successfully deployed $func${NC}"
    else
        echo -e "❌ ${RED}Failed to deploy $func${NC}"
        success=false
    fi
done

# Set secrets
echo -e "\n🔐 Setting secrets..."
if supabase secrets set --project-ref $PROJECT_REF \
  OPENAI_API_KEY=$OPENAI_API_KEY \
  SUPABASE_URL=$VITE_SUPABASE_URL \
  SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY; then
    echo -e "✅ ${GREEN}Successfully set secrets${NC}"
else
    echo -e "❌ ${RED}Failed to set secrets${NC}"
    success=false
fi

# Cleanup
rm supabase/config.toml

echo -e "\n==========================="
if [ "$success" = true ]; then
    echo -e "${GREEN}🎉 Deployment complete!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Deployment completed with errors${NC}"
    exit 1
fi 