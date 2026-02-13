#!/bin/bash

# Start infrastructure
echo "Starting Docker containers..."
docker-compose up -d

# Wait for Postgres to be ready
echo "Waiting for Postgres..."
sleep 5

# Run migrations
echo "Running migrations..."
cd server
npm install
npm run db:migrate
cd ..

# Start services
echo "To start services, open 3 terminals:"
echo "1. server/ -> npm run dev"
echo "2. collab-server/ -> npm run dev"
echo "3. root/ -> npm run dev"
