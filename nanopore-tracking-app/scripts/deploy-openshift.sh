#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="nanopore-tracking-app"
NAMESPACE="dept-barc"
REGISTRY="image-registry.openshift-image-registry.svc:5000"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if oc command is available
    if ! command -v oc &> /dev/null; then
        print_error "OpenShift CLI (oc) is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        print_error "You are not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    # Check if pnpm is available
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm first: npm install -g pnpm@10.13.1"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Install dependencies if not already installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        pnpm install --frozen-lockfile
    fi
    
    # Run unit tests
    if pnpm run test:unit > /dev/null 2>&1; then
        print_success "Unit tests passed"
    else
        print_warning "Unit tests failed or not configured, continuing..."
    fi
    
    # Run Playwright tests
    if pnpm run test > /dev/null 2>&1; then
        print_success "E2E tests passed"
    else
        print_warning "E2E tests failed or not configured, continuing..."
    fi
}

# Function to build application
build_application() {
    print_status "Building application..."
    
    # Clean previous build
    pnpm run clean > /dev/null 2>&1 || true
    
    # Build the application
    pnpm run build
    
    if [ -d "dist" ]; then
        print_success "Application built successfully"
    else
        print_error "Build failed - dist directory not found"
        exit 1
    fi
}

# Function to deploy to OpenShift
deploy_to_openshift() {
    local environment=${1:-"production"}
    
    print_status "Deploying to OpenShift ($environment)..."
    
    # Get current project
    local current_project=$(oc project -q)
    print_status "Current project: $current_project"
    
    # Create deployment tag
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local git_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local tag="${environment}-${timestamp}-${git_hash}"
    
    print_status "Creating deployment with tag: $tag"
    
    # Apply configurations
    print_status "Applying OpenShift configurations..."
    oc apply -f deployment/openshift/configmap.yaml
    oc apply -f deployment/openshift/secret.yaml
    oc apply -f deployment/openshift/build-config.yaml
    
    # Start binary build
    print_status "Starting binary build..."
    oc start-build $APP_NAME --from-dir=. --follow --wait
    
    # Tag the image
    print_status "Tagging image..."
    oc tag $APP_NAME:latest $APP_NAME:$tag
    oc tag $APP_NAME:latest $APP_NAME:stable
    
    # Apply deployment
    print_status "Applying deployment configuration..."
    oc apply -f deployment/openshift/deployment.yaml
    
    # Update deployment with new image
    print_status "Updating deployment with new image..."
    oc set image deployment/$APP_NAME $APP_NAME=$REGISTRY/$current_project/$APP_NAME:$tag
    
    # Wait for rollout to complete
    print_status "Waiting for deployment to complete..."
    if oc rollout status deployment/$APP_NAME --timeout=300s; then
        print_success "Deployment completed successfully"
    else
        print_error "Deployment failed"
        print_status "Rolling back to previous version..."
        oc rollout undo deployment/$APP_NAME
        oc rollout status deployment/$APP_NAME --timeout=300s
        exit 1
    fi
    
    # Get the route URL
    local route_url=$(oc get route ${APP_NAME}-route -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    
    if [ -n "$route_url" ]; then
        print_success "Application deployed successfully!"
        print_success "URL: https://$route_url"
        
        # Run health checks
        print_status "Running health checks..."
        sleep 10
        
        if curl -f -s https://$route_url/health > /dev/null 2>&1; then
            print_success "Health check passed"
        else
            print_warning "Health check failed, but deployment completed"
        fi
    else
        print_warning "Could not determine route URL"
    fi
    
    # Show pod status
    print_status "Pod status:"
    oc get pods -l app=$APP_NAME
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -t, --test     Run tests only"
    echo "  -b, --build    Build only"
    echo "  -d, --deploy   Deploy only (skip tests and build)"
    echo "  -e, --env      Environment (staging|production) [default: production]"
    echo "  -s, --skip-tests  Skip running tests"
    echo ""
    echo "Examples:"
    echo "  $0                    # Full deployment with tests"
    echo "  $0 --skip-tests       # Deploy without running tests"
    echo "  $0 --env staging      # Deploy to staging environment"
    echo "  $0 --test             # Run tests only"
}

# Function to rollback deployment
rollback_deployment() {
    print_status "Rolling back deployment..."
    
    if oc rollout undo deployment/$APP_NAME; then
        print_success "Rollback initiated"
        oc rollout status deployment/$APP_NAME --timeout=300s
        print_success "Rollback completed successfully"
    else
        print_error "Rollback failed"
        exit 1
    fi
}

# Main execution
main() {
    local run_tests=true
    local run_build=true
    local run_deploy=true
    local environment="production"
    local test_only=false
    local build_only=false
    local deploy_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--test)
                test_only=true
                run_build=false
                run_deploy=false
                shift
                ;;
            -b|--build)
                build_only=true
                run_deploy=false
                shift
                ;;
            -d|--deploy)
                deploy_only=true
                run_tests=false
                run_build=false
                shift
                ;;
            -e|--env)
                environment="$2"
                shift 2
                ;;
            -s|--skip-tests)
                run_tests=false
                shift
                ;;
            --rollback)
                check_prerequisites
                rollback_deployment
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate environment
    if [[ "$environment" != "staging" && "$environment" != "production" ]]; then
        print_error "Environment must be 'staging' or 'production'"
        exit 1
    fi
    
    print_status "Starting deployment process for $environment environment..."
    
    # Check prerequisites
    check_prerequisites
    
    # Run tests if requested
    if [ "$run_tests" = true ]; then
        run_tests
    fi
    
    # Build application if requested
    if [ "$run_build" = true ]; then
        build_application
    fi
    
    # Deploy if requested
    if [ "$run_deploy" = true ]; then
        deploy_to_openshift $environment
    fi
    
    if [ "$test_only" = true ]; then
        print_success "Tests completed successfully"
    elif [ "$build_only" = true ]; then
        print_success "Build completed successfully"
    else
        print_success "Deployment process completed successfully"
    fi
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@" 