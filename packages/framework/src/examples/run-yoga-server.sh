#!/bin/bash

# Yoga GraphQL Server Runner
# This script runs the basic Yoga GraphQL server

set -e

echo "🚀 Starting Yoga GraphQL Server..."

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo "❌ Error: bun is not installed or not in PATH"
    echo "Please install bun: https://bun.sh/"
    exit 1
fi

# Check if the server file exists
SERVER_FILE="packages/framework/examples/basic-yoga-server.ts"
if [ ! -f "$SERVER_FILE" ]; then
    echo "❌ Error: Server file not found: $SERVER_FILE"
    exit 1
fi

# Set default environment variables
export PORT=${PORT:-4000}
export HOST=${HOST:-localhost}

echo "📋 Configuration:"
echo "  • Port: $PORT"
echo "  • Host: $HOST"
echo "  • Server: $SERVER_FILE"
echo ""

# Run the server
echo "🎯 Starting server..."
bun "$SERVER_FILE" 