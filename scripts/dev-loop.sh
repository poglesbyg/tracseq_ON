#!/bin/bash

# TracSeq ON Development Loop Automation Script
# This script automates common development tasks and fixes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DEV-LOOP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to start Ollama service
start_ollama() {
    print_status "Checking Ollama service..."
    
    if ! command_exists ollama; then
        print_error "Ollama not installed. Please install it first."
        return 1
    fi
    
    # Check if Ollama is already running
    if port_in_use 11434; then
        print_status "Ollama service already running on port 11434"
    else
        print_status "Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        sleep 3
    fi
    
    # Test if models are available
    local models=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name"' | wc -l)
    if [ "$models" -eq 0 ]; then
        print_warning "No models found in API. Attempting to load default model..."
        ollama run llama3.1:8b "test" > /dev/null 2>&1 || true
        sleep 2
    fi
    
    print_success "Ollama service is ready"
}

# Function to check and start PostgreSQL
start_postgres() {
    print_status "Checking PostgreSQL..."
    
    if command_exists brew; then
        if ! brew services list | grep postgresql | grep started > /dev/null; then
            print_status "Starting PostgreSQL..."
            brew services start postgresql@15 || brew services start postgresql
        else
            print_success "PostgreSQL already running"
        fi
    else
        print_warning "Homebrew not found. Please ensure PostgreSQL is running manually."
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '#' | xargs)
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL="postgres://localhost:5432/monorepo-scaffold"
        print_warning "Using default DATABASE_URL: $DATABASE_URL"
    fi
    
    pnpm --filter @app/db db:migrate || {
        print_error "Database migration failed. Please check your database connection."
        return 1
    }
    
    print_success "Database migrations completed"
}

# Function to install dependencies
install_deps() {
    print_status "Installing dependencies..."
    
    if [ ! -f "pnpm-lock.yaml" ] || [ "package.json" -nt "pnpm-lock.yaml" ]; then
        pnpm install
        print_success "Dependencies installed"
    else
        print_status "Dependencies up to date"
    fi
}

# Function to run type checking
type_check() {
    print_status "Running TypeScript type checking..."
    
    if pnpm typecheck; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed. Please fix TypeScript errors."
        return 1
    fi
}

# Function to run linting
lint_code() {
    print_status "Running linter..."
    
    if pnpm lint; then
        print_success "Linting passed"
    else
        print_warning "Linting issues found. Running auto-fix..."
        pnpm fix || true
    fi
}

# Function to start development server
start_dev_server() {
    print_status "Starting development server..."
    
    # Kill any existing dev servers
    pkill -f "astro dev" || true
    sleep 1
    
    # Start the development server
    print_success "Development server starting on http://localhost:3005"
    pnpm dev
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Unit tests
    if pnpm test; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        return 1
    fi
    
    # E2E tests (if requested)
    if [ "$1" = "--e2e" ]; then
        print_status "Running E2E tests..."
        if pnpm test:e2e; then
            print_success "E2E tests passed"
        else
            print_error "E2E tests failed"
            return 1
        fi
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    
    # Clean build artifacts
    pnpm --filter @app/web clean
    
    # Clear node_modules if requested
    if [ "$1" = "--deep" ]; then
        print_status "Deep cleaning - removing node_modules..."
        find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
        rm -f pnpm-lock.yaml
    fi
    
    print_success "Cleanup completed"
}

# Function to show help
show_help() {
    echo "TracSeq ON Development Loop Automation"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start         Start all services and development server"
    echo "  test          Run unit tests"
    echo "  test --e2e    Run unit and E2E tests"
    echo "  check         Run type checking and linting"
    echo "  clean         Clean build artifacts"
    echo "  clean --deep  Deep clean (remove node_modules)"
    echo "  ollama        Start/fix Ollama service"
    echo "  db            Run database migrations"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start      # Full development setup"
    echo "  $0 check      # Quick code quality check"
    echo "  $0 test --e2e # Run all tests"
}

# Main script logic
main() {
    local command=${1:-start}
    
    case $command in
        start)
            print_status "Starting TracSeq ON development environment..."
            start_ollama
            start_postgres
            install_deps
            run_migrations
            type_check
            lint_code
            start_dev_server
            ;;
        test)
            install_deps
            run_tests $2
            ;;
        check)
            install_deps
            type_check
            lint_code
            ;;
        clean)
            cleanup $2
            ;;
        ollama)
            start_ollama
            ;;
        db)
            start_postgres
            run_migrations
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 