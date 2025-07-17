#!/bin/bash

# Microservices Development Environment Startup Script
# This script starts all microservices and their dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="deployment/docker/docker-compose.microservices.yml"
GATEWAY_URL="http://localhost:3001"
DISCOVERY_URL="http://localhost:3001/api/discovery"
GRAFANA_URL="http://localhost:3000"
PROMETHEUS_URL="http://localhost:9090"

echo -e "${BLUE}🚀 Starting Nanopore Microservices Development Environment${NC}"
echo "=================================================="

# Function to check if a service is healthy
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service_name to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}   Attempt $attempt/$max_attempts - $service_name not ready yet...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy after $max_attempts attempts${NC}"
    return 1
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Check if required ports are available
echo -e "${BLUE}🔍 Checking port availability...${NC}"
required_ports=(3001 3002 3003 3004 3005 3006 5432 5433 5434 11434 6333 6379 9090 3000)
for port in "${required_ports[@]}"; do
    if ! check_port $port; then
        echo -e "${RED}Please free up port $port and try again.${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required ports are available${NC}"

# Stop any existing containers
echo -e "${BLUE}🛑 Stopping any existing containers...${NC}"
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Build and start services
echo -e "${BLUE}🔨 Building and starting services...${NC}"
docker-compose -f $COMPOSE_FILE up -d --build

# Wait for databases to be ready
echo -e "${BLUE}🗄️  Waiting for databases to be ready...${NC}"
sleep 10

# Check database health
echo -e "${BLUE}🔍 Checking database health...${NC}"
for db in sample-db auth-db audit-db; do
    if ! docker-compose -f $COMPOSE_FILE exec -T $db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${RED}❌ $db is not ready${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ $db is ready${NC}"
done

# Run database migrations
echo -e "${BLUE}📊 Running database migrations...${NC}"
for db in sample-db auth-db audit-db; do
    echo -e "${YELLOW}Running migrations for $db...${NC}"
    # Add migration commands here when available
done

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 15

# Check service health
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check API Gateway
if check_service_health "API Gateway" "$GATEWAY_URL/health"; then
    echo -e "${GREEN}✅ API Gateway is ready${NC}"
else
    echo -e "${RED}❌ API Gateway failed to start${NC}"
    exit 1
fi

# Check Service Discovery
if check_service_health "Service Discovery" "$DISCOVERY_URL?action=health"; then
    echo -e "${GREEN}✅ Service Discovery is ready${NC}"
else
    echo -e "${RED}❌ Service Discovery failed to start${NC}"
    exit 1
fi

# Check individual services
services=(
    "sample-management:3002"
    "ai-processing:3003"
    "authentication:3004"
    "file-storage:3005"
    "audit:3006"
)

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    service_port=$(echo $service | cut -d: -f2)
    health_url="http://localhost:$service_port/health"
    
    if check_service_health "$service_name" "$health_url"; then
        echo -e "${GREEN}✅ $service_name is ready${NC}"
    else
        echo -e "${RED}❌ $service_name failed to start${NC}"
        exit 1
    fi
done

# Check monitoring services
echo -e "${BLUE}📊 Checking monitoring services...${NC}"

if check_service_health "Prometheus" "$PROMETHEUS_URL/-/healthy"; then
    echo -e "${GREEN}✅ Prometheus is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Prometheus may still be starting up${NC}"
fi

if check_service_health "Grafana" "$GRAFANA_URL/api/health"; then
    echo -e "${GREEN}✅ Grafana is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Grafana may still be starting up${NC}"
fi

# Display service information
echo ""
echo -e "${BLUE}🎉 Microservices Development Environment is Ready!${NC}"
echo "=================================================="
echo -e "${GREEN}📋 Service URLs:${NC}"
echo -e "  API Gateway:     ${BLUE}$GATEWAY_URL${NC}"
echo -e "  Sample Service:  ${BLUE}http://localhost:3002${NC}"
echo -e "  AI Service:      ${BLUE}http://localhost:3003${NC}"
echo -e "  Auth Service:    ${BLUE}http://localhost:3004${NC}"
echo -e "  File Service:    ${BLUE}http://localhost:3005${NC}"
echo -e "  Audit Service:   ${BLUE}http://localhost:3006${NC}"
echo ""
echo -e "${GREEN}🔧 Management URLs:${NC}"
echo -e "  Service Discovery: ${BLUE}$DISCOVERY_URL${NC}"
echo -e "  Grafana:           ${BLUE}$GRAFANA_URL${NC} (admin/admin)"
echo -e "  Prometheus:        ${BLUE}$PROMETHEUS_URL${NC}"
echo ""
echo -e "${GREEN}🗄️  Database URLs:${NC}"
echo -e "  Sample DB:         ${BLUE}localhost:5432${NC}"
echo -e "  Auth DB:           ${BLUE}localhost:5433${NC}"
echo -e "  Audit DB:          ${BLUE}localhost:5434${NC}"
echo ""
echo -e "${GREEN}🔍 Health Check URLs:${NC}"
echo -e "  Gateway Health:    ${BLUE}$GATEWAY_URL/health${NC}"
echo -e "  Discovery Health:  ${BLUE}$DISCOVERY_URL?action=health${NC}"
echo ""
echo -e "${YELLOW}💡 Useful Commands:${NC}"
echo -e "  View logs:         ${BLUE}docker-compose -f $COMPOSE_FILE logs -f [service-name]${NC}"
echo -e "  Stop services:     ${BLUE}docker-compose -f $COMPOSE_FILE down${NC}"
echo -e "  Restart service:   ${BLUE}docker-compose -f $COMPOSE_FILE restart [service-name]${NC}"
echo -e "  Scale service:     ${BLUE}docker-compose -f $COMPOSE_FILE up -d --scale [service-name]=2${NC}"
echo ""
echo -e "${GREEN}✅ All services are running successfully!${NC}"