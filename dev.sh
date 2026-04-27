#!/bin/bash

# Exit on any error
set -e

# Define colors for better readability
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
echo -e "${BOLD}${BLUE}--- Food Delivery API Tool ---${NC}"

# Function to show help
show_help() {
    echo -e "${BOLD}Usage:${NC} ./setup.sh [command]"
    echo -e ""
    echo -e "${BOLD}Commands:${NC}"
    echo -e "  ${BLUE}setup${NC}    Install dependencies, setup environment, and initialize database"
    echo -e "  ${BLUE}run${NC}      Start the application in development mode"
    echo -e "  ${BLUE}all${NC}      Perform setup and then start the application (default)"
    echo -e "  ${BLUE}help${NC}     Show this help message"
}

# Function to perform setup
perform_setup() {
    echo -e "${BOLD}${BLUE}🚀 Starting Project Setup...${NC}"

    # 1. Check for required tools
    echo -e "\n${BOLD}${YELLOW}Step 1: Checking requirements...${NC}"
    command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required but not installed. Aborting.${NC}" >&2; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required but not installed. Aborting.${NC}" >&2; exit 1; }
    command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed. Aborting.${NC}" >&2; exit 1; }
    echo -e "${GREEN}✅ All requirements met.${NC}"

    # 2. Install dependencies
    echo -e "\n${BOLD}${YELLOW}Step 2: Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed successfully.${NC}"

    # 3. Environment setup
    echo -e "\n${BOLD}${YELLOW}Step 3: Setting up environment files...${NC}"
    if [ ! -f .env.local ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✅ .env.local created.${NC}"
    fi
    if [ ! -f .env.test ]; then
        cp .env.example .env.test
        echo -e "${GREEN}✅ .env.test created.${NC}"
    fi

    # 4. Starting Docker dependencies
    echo -e "\n${BOLD}${YELLOW}Step 4: Starting Docker containers...${NC}"
    docker compose up -d
    echo -e "${GREEN}✅ Docker containers are up.${NC}"

    # Wait for database to be ready
    echo -ne "${BLUE}⏳ Waiting for database to be ready...${NC}"
    MAX_RETRIES=30
    RETRY_COUNT=0
    until docker exec $(docker compose ps -q db) pg_isready -U dev_user -d food_delivery >/dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
        echo -n "."
        sleep 2
        ((RETRY_COUNT++))
    done
    echo ""

    # 5. Database setup
    echo -e "\n${BOLD}${YELLOW}Step 5: Running database migrations and seeding...${NC}"
    npm run db:reset
    echo -e "${GREEN}✅ Database ready.${NC}"
    
    echo -e "\n${BOLD}${GREEN}🎉 Setup completed successfully!${NC}"
}

# Function to run the app
start_app() {
    echo -e "\n${BOLD}${BLUE}🚀 Starting the application...${NC}"
    npm run dev
}

# Handle Arguments
COMMAND=${1:-"all"}

case $COMMAND in
    "setup")
        perform_setup
        ;;
    "run")
        start_app
        ;;
    "all")
        perform_setup
        start_app
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac
