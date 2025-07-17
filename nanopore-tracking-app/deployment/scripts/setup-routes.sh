#!/bin/bash

# Route Setup Script for Nanopore Tracking App
# This script sets up external routes for accessing the application

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
BASE_DOMAIN="apps.ocp4.onrc.online"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_route() {
    echo -e "${CYAN}[ROUTE]${NC} $1"
}

# Function to check if route exists
route_exists() {
    local route_name="$1"
    oc get route "$route_name" >/dev/null 2>&1
}

# Function to get route URL
get_route_url() {
    local route_name="$1"
    oc get route "$route_name" -o jsonpath='{.spec.host}' 2>/dev/null || echo ""
}

# Function to test route accessibility
test_route() {
    local route_name="$1"
    local path="${2:-/}"
    local expected_status="${3:-200}"
    
    local url
    url=$(get_route_url "$route_name")
    
    if [ -z "$url" ]; then
        log_error "Route $route_name not found"
        return 1
    fi
    
    local full_url="https://$url$path"
    log_info "Testing route: $full_url"
    
    # Test with curl
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$full_url" || echo "000")
    
    if [ "$status_code" = "$expected_status" ]; then
        log_success "✓ Route $route_name is accessible (HTTP $status_code)"
        return 0
    else
        log_error "✗ Route $route_name returned HTTP $status_code (expected $expected_status)"
        return 1
    fi
}

# Function to create routes
create_routes() {
    log_info "Creating OpenShift routes..."
    
    # Apply routes configuration
    if oc apply -f deployment/openshift/routes.yaml; then
        log_success "Routes configuration applied successfully"
    else
        log_error "Failed to apply routes configuration"
        return 1
    fi
    
    # Wait for routes to be ready
    log_info "Waiting for routes to be ready..."
    sleep 10
    
    # List created routes
    log_info "Created routes:"
    oc get routes -o custom-columns=NAME:.metadata.name,HOST:.spec.host,TLS:.spec.tls.termination,TARGET:.spec.to.name
}

# Function to update routes
update_routes() {
    log_info "Updating existing routes..."
    
    # Check if routes exist
    local routes=("nanopore-tracking-app" "nanopore-metrics" "nanopore-health")
    
    for route in "${routes[@]}"; do
        if route_exists "$route"; then
            log_info "Updating route: $route"
            oc apply -f deployment/openshift/routes.yaml
        else
            log_warning "Route $route does not exist, will create it"
        fi
    done
    
    create_routes
}

# Function to delete routes
delete_routes() {
    log_info "Deleting OpenShift routes..."
    
    local routes=("nanopore-tracking-app" "nanopore-metrics" "nanopore-health")
    
    for route in "${routes[@]}"; do
        if route_exists "$route"; then
            log_info "Deleting route: $route"
            oc delete route "$route" || log_warning "Failed to delete route $route"
        else
            log_warning "Route $route does not exist"
        fi
    done
}

# Function to test all routes
test_routes() {
    log_info "Testing all routes..."
    echo ""
    
    local success_count=0
    local total_routes=3
    
    # Test main application route
    if test_route "nanopore-tracking-app" "/" "200"; then
        success_count=$((success_count + 1))
    fi
    
    # Test health route
    if test_route "nanopore-health" "/health" "200"; then
        success_count=$((success_count + 1))
    fi
    
    # Test metrics route (might return 404 if not implemented)
    if test_route "nanopore-metrics" "/api/metrics" "200"; then
        success_count=$((success_count + 1))
    elif test_route "nanopore-metrics" "/api/metrics" "404"; then
        log_warning "Metrics endpoint not implemented (HTTP 404) - this is expected"
        success_count=$((success_count + 1))
    fi
    
    echo ""
    log_info "Route test summary: $success_count/$total_routes routes working"
    
    if [ $success_count -eq $total_routes ]; then
        log_success "All routes are working correctly!"
        return 0
    else
        log_warning "Some routes may have issues"
        return 1
    fi
}

# Function to show route information
show_routes() {
    log_info "Current route information:"
    echo ""
    
    if ! oc get routes >/dev/null 2>&1; then
        log_error "No routes found or unable to access routes"
        return 1
    fi
    
    # Show detailed route information
    oc get routes -o custom-columns=NAME:.metadata.name,HOST:.spec.host,TLS:.spec.tls.termination,TARGET:.spec.to.name,PATH:.spec.path
    
    echo ""
    log_info "Route URLs:"
    
    local routes=("nanopore-tracking-app" "nanopore-metrics" "nanopore-health")
    
    for route in "${routes[@]}"; do
        if route_exists "$route"; then
            local url
            url=$(get_route_url "$route")
            local path
            path=$(oc get route "$route" -o jsonpath='{.spec.path}' 2>/dev/null || echo "")
            
            case "$route" in
                "nanopore-tracking-app")
                    log_route "🌐 Main Application: https://$url"
                    ;;
                "nanopore-health")
                    log_route "❤️  Health Check: https://$url$path"
                    ;;
                "nanopore-metrics")
                    log_route "📊 Metrics: https://$url$path"
                    ;;
            esac
        else
            log_warning "Route $route not found"
        fi
    done
    
    echo ""
    log_info "Quick access commands:"
    echo "  curl -k https://$(get_route_url nanopore-tracking-app)/"
    echo "  curl -k https://$(get_route_url nanopore-health)/health"
    echo "  curl -k https://$(get_route_url nanopore-metrics)/api/metrics"
}

# Function to configure route security
configure_security() {
    log_info "Configuring route security..."
    
    # Add security annotations to routes
    local routes=("nanopore-tracking-app" "nanopore-metrics" "nanopore-health")
    
    for route in "${routes[@]}"; do
        if route_exists "$route"; then
            log_info "Adding security annotations to route: $route"
            
            # Add security headers
            oc annotate route "$route" \
                haproxy.router.openshift.io/hsts_header="max-age=31536000;includeSubDomains;preload" \
                --overwrite || log_warning "Failed to add HSTS header to $route"
            
            # Add rate limiting (if supported)
            oc annotate route "$route" \
                haproxy.router.openshift.io/rate-limit-connections="100" \
                --overwrite || log_warning "Failed to add rate limiting to $route"
            
        else
            log_warning "Route $route does not exist, skipping security configuration"
        fi
    done
    
    log_success "Security configuration completed"
}

# Function to monitor routes
monitor_routes() {
    local interval="${1:-30}"
    local duration="${2:-300}"
    local end_time=$(($(date +%s) + duration))
    
    log_info "Starting route monitoring for ${duration}s (interval: ${interval}s)"
    echo "Time,Route,Status,ResponseTime"
    
    while [ $(date +%s) -lt $end_time ]; do
        local routes=("nanopore-tracking-app" "nanopore-health")
        
        for route in "${routes[@]}"; do
            if route_exists "$route"; then
                local url
                url=$(get_route_url "$route")
                local path=""
                
                if [ "$route" = "nanopore-health" ]; then
                    path="/health"
                fi
                
                local full_url="https://$url$path"
                local start_time
                start_time=$(date +%s%3N)
                
                local status_code
                status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$full_url" || echo "000")
                
                local end_time_ms
                end_time_ms=$(date +%s%3N)
                local response_time=$((end_time_ms - start_time))
                
                echo "$(date '+%H:%M:%S'),$route,$status_code,${response_time}ms"
            fi
        done
        
        sleep "$interval"
    done
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create              Create routes (default)"
    echo "  update              Update existing routes"
    echo "  delete              Delete all routes"
    echo "  test                Test route accessibility"
    echo "  show                Show current route information"
    echo "  security            Configure route security"
    echo "  monitor [interval]  Monitor routes continuously"
    echo "  help                Show this help message"
    echo ""
    echo "Options for monitor:"
    echo "  interval            Monitoring interval in seconds (default: 30)"
    echo "  duration            Total monitoring duration in seconds (default: 300)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Create routes"
    echo "  $0 create           # Create routes"
    echo "  $0 test             # Test all routes"
    echo "  $0 show             # Show route information"
    echo "  $0 monitor 10       # Monitor routes every 10 seconds"
    echo ""
}

# Main function
main() {
    local command="${1:-create}"
    
    case "$command" in
        "create")
            create_routes
            show_routes
            ;;
        "update")
            update_routes
            show_routes
            ;;
        "delete")
            delete_routes
            ;;
        "test")
            test_routes
            ;;
        "show")
            show_routes
            ;;
        "security")
            configure_security
            ;;
        "monitor")
            local interval="${2:-30}"
            local duration="${3:-300}"
            monitor_routes "$interval" "$duration"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Check prerequisites
if ! command -v oc >/dev/null 2>&1; then
    log_error "OpenShift CLI (oc) is required but not installed"
    exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
    log_warning "curl is recommended for route testing"
fi

# Run main function
main "$@" 