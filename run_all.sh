#!/bin/bash
set -e

# Function to kill child processes on exit
trap 'kill $(jobs -p)' SIGINT SIGTERM EXIT

# Load environment variables explicitly
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "🚀 Starting Agentic LMS Local Environment..."

# 1. Start Database
echo "🐘 Starting PostgreSQL (Docker)..."
docker-compose up -d
sleep 3 # Wait for DB

# 2. Start Backend
echo "🔙 Starting Backend (Port 8000)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --port 8000 --reload &
BACKEND_PID=$!
cd ..

# 3. Start MCP Server
echo "🛠️ Starting MCP Server (Port 8080)..."
cd mcp-server
source .venv/bin/activate
# PORT=8080 python server.py &
# server.py calls mcp.run() with PORT env
PORT=8080 python server.py &
MCP_PID=$!
cd ..

# 4. Start Learner Agent
echo "🤖 Starting Learner Agent (Port 10000)..."
# Using uv run to execute in the root environment
uv run uvicorn learner_agent.agent:a2a_app --port 10000 --reload &
LEARNER_AGENT_PID=$!

# 5. Start Grading Agent
echo "🤖 Starting Grading Agent (Port 10001)..."
# Using uv run to execute in the root environment
uv run uvicorn grading_agent.agent:a2a_app --port 10001 --reload &
GRADING_AGENT_PID=$!

# 6. Start Frontend
echo "🎨 Starting Frontend (Port 3000)..."
cd frontend
# Ensure correct node version
source ~/.nvm/nvm.sh && nvm use 20
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ All services started!"
echo "- Frontend: http://localhost:3000"
echo "- Backend: http://localhost:8000/docs"
echo "- MCP: http://localhost:8080/sse"

wait
