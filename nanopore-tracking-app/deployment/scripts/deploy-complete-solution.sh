#!/bin/bash

# Complete Service Mesh Solution Deployment Script
# Phases 4 & 5: Performance Optimization and Security Hardening

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
APP_NAME="nanopore-tracking-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="${SCRIPT_DIR}/../openshift"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command_exists oc; then
        log_error "OpenShift CLI (oc) is required but not installed"
        exit 1
    fi
    
    if ! command_exists kubectl; then
        log_error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check if logged into OpenShift
    if ! oc whoami >/dev/null 2>&1; then
        log_error "Not logged into OpenShift. Please run 'oc login' first"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to check resource quotas
check_quotas() {
    log_info "Checking resource quotas..."
    
    # Check if namespace exists
    if ! oc get namespace "$NAMESPACE" >/dev/null 2>&1; then
        log_error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi
    
    # Get quota information
    local quota_output
    quota_output=$(oc get resourcequota -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    if echo "$quota_output" | jq -e '.items | length > 0' >/dev/null; then
        log_info "Resource quotas found:"
        echo "$quota_output" | jq -r '.items[] | "\(.metadata.name): \(.status.used // {}) / \(.status.hard // {})"'
        
        # Check specific quotas
        local pods_used pods_limit services_used services_limit
        pods_used=$(echo "$quota_output" | jq -r '.items[0].status.used.pods // "0"')
        pods_limit=$(echo "$quota_output" | jq -r '.items[0].status.hard.pods // "10"')
        services_used=$(echo "$quota_output" | jq -r '.items[0].status.used.services // "0"')
        services_limit=$(echo "$quota_output" | jq -r '.items[0].status.hard.services // "10"')
        
        log_info "Pods: $pods_used/$pods_limit"
        log_info "Services: $services_used/$services_limit"
        
        if [ "$services_used" -ge "$services_limit" ]; then
            log_warning "Service quota is at limit. Some deployments may fail."
        fi
    else
        log_info "No resource quotas found"
    fi
}

# Function to deploy service account and RBAC
deploy_service_account() {
    log_info "Deploying service account and RBAC..."
    
    if oc apply -f "$DEPLOYMENT_DIR/service-account.yaml"; then
        log_success "Service account deployed successfully"
    else
        log_error "Failed to deploy service account"
        return 1
    fi
    
    # Wait for service account to be ready
    oc wait --for=condition=ready serviceaccount/nanopore-tracking-sa -n "$NAMESPACE" --timeout=60s
}

# Function to deploy security hardening
deploy_security_hardening() {
    log_info "Deploying security hardening configuration..."
    
    if oc apply -f "$DEPLOYMENT_DIR/security-hardening.yaml"; then
        log_success "Security hardening deployed successfully"
    else
        log_error "Failed to deploy security hardening"
        return 1
    fi
    
    # Check if SecurityContextConstraints was created
    if oc get scc nanopore-tracking-scc >/dev/null 2>&1; then
        log_success "SecurityContextConstraints created successfully"
    else
        log_warning "SecurityContextConstraints may not have been created (requires admin privileges)"
    fi
    
    # Check network policy
    if oc get networkpolicy nanopore-tracking-network-policy -n "$NAMESPACE" >/dev/null 2>&1; then
        log_success "Network policy created successfully"
    else
        log_warning "Network policy creation failed"
    fi
}

# Function to deploy enhanced monitoring
deploy_enhanced_monitoring() {
    log_info "Deploying enhanced monitoring and alerting..."
    
    if oc apply -f "$DEPLOYMENT_DIR/enhanced-monitoring.yaml"; then
        log_success "Enhanced monitoring deployed successfully"
    else
        log_error "Failed to deploy enhanced monitoring"
        return 1
    fi
    
    # Check if ServiceMonitor was created
    if oc get servicemonitor nanopore-performance-monitor -n "$NAMESPACE" >/dev/null 2>&1; then
        log_success "Performance ServiceMonitor created successfully"
    else
        log_warning "Performance ServiceMonitor may not have been created (requires Prometheus operator)"
    fi
    
    # Check if PrometheusRule was created
    if oc get prometheusrule nanopore-performance-alerts -n "$NAMESPACE" >/dev/null 2>&1; then
        log_success "Performance alerts created successfully"
    else
        log_warning "Performance alerts may not have been created (requires Prometheus operator)"
    fi
}

# Function to deploy quota-optimized service mesh
deploy_quota_optimized_service_mesh() {
    log_info "Deploying quota-optimized service mesh..."
    
    if oc apply -f "$DEPLOYMENT_DIR/quota-optimized-service-mesh.yaml"; then
        log_success "Quota-optimized service mesh deployed successfully"
    else
        log_error "Failed to deploy quota-optimized service mesh"
        return 1
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for service mesh deployment to be ready..."
    if oc wait --for=condition=available deployment/nanopore-tracking-app -n "$NAMESPACE" --timeout=300s; then
        log_success "Service mesh deployment is ready"
    else
        log_error "Service mesh deployment failed to become ready"
        return 1
    fi
}

# Function to deploy Prometheus (if not already deployed)
deploy_prometheus() {
    log_info "Checking Prometheus deployment..."
    
    if oc get deployment prometheus -n "$NAMESPACE" >/dev/null 2>&1; then
        log_info "Prometheus already deployed"
        return 0
    fi
    
    log_info "Deploying memory-optimized Prometheus..."
    
    if oc apply -f "$DEPLOYMENT_DIR/simple-prometheus.yaml"; then
        log_success "Prometheus deployed successfully"
        
        # Wait for Prometheus to be ready
        log_info "Waiting for Prometheus to be ready..."
        if oc wait --for=condition=available deployment/prometheus -n "$NAMESPACE" --timeout=300s; then
            log_success "Prometheus is ready"
        else
            log_warning "Prometheus deployment may not be fully ready"
        fi
    else
        log_error "Failed to deploy Prometheus"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Check pod status
    log_info "Checking pod status..."
    oc get pods -n "$NAMESPACE" -l app=nanopore-tracking-app
    
    # Check if main app is healthy
    local app_pod
    app_pod=$(oc get pods -n "$NAMESPACE" -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$app_pod" ]; then
        log_info "Checking application health..."
        if oc exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log_success "Application health check passed"
        else
            log_warning "Application health check failed"
        fi
        
        # Check service mesh health
        log_info "Checking service mesh health..."
        if oc exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3001/api/service-mesh/health >/dev/null 2>&1; then
            log_success "Service mesh health check passed"
        else
            log_warning "Service mesh health check failed"
        fi
        
        # Check security hardening
        log_info "Checking security hardening..."
        if oc exec -n "$NAMESPACE" "$app_pod" -- curl -f http://localhost:3001/api/security/hardening >/dev/null 2>&1; then
            log_success "Security hardening health check passed"
        else
            log_warning "Security hardening health check failed"
        fi
    else
        log_warning "No application pod found for health checks"
    fi
    
    # Check Prometheus if deployed
    local prometheus_pod
    prometheus_pod=$(oc get pods -n "$NAMESPACE" -l app=prometheus -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$prometheus_pod" ]; then
        log_info "Checking Prometheus health..."
        if oc exec -n "$NAMESPACE" "$prometheus_pod" -- curl -f http://localhost:9090/-/healthy >/dev/null 2>&1; then
            log_success "Prometheus health check passed"
        else
            log_warning "Prometheus health check failed"
        fi
    fi
}

# Function to run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    local app_pod
    app_pod=$(oc get pods -n "$NAMESPACE" -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$app_pod" ]; then
        log_info "Running baseline performance test..."
        
        # Run a simple load test
        local test_result
        test_result=$(oc exec -n "$NAMESPACE" "$app_pod" -- curl -X POST -H "Content-Type: application/json" \
            -d '{"testType": "circuit-breaker"}' \
            http://localhost:3001/api/performance/load-test 2>/dev/null || echo '{"success": false}')
        
        if echo "$test_result" | jq -e '.success' >/dev/null 2>&1; then
            log_success "Performance test completed successfully"
            echo "$test_result" | jq -r '.result.testName + ": " + (.result.requestsPerSecond | tostring) + " req/s"'
        else
            log_warning "Performance test failed or incomplete"
        fi
    else
        log_warning "No application pod found for performance tests"
    fi
}

# Function to display deployment summary
display_summary() {
    log_info "Deployment Summary"
    echo "===================="
    
    # Get deployment status
    local deployments
    deployments=$(oc get deployments -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    echo "Deployments:"
    echo "$deployments" | jq -r '.items[] | "\(.metadata.name): \(.status.readyReplicas // 0)/\(.status.replicas // 0) ready"'
    
    # Get service information
    local services
    services=$(oc get services -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    echo ""
    echo "Services:"
    echo "$services" | jq -r '.items[] | "\(.metadata.name): \(.spec.clusterIP // "None"):\(.spec.ports[0].port // "N/A")"'
    
    # Get route information
    local routes
    routes=$(oc get routes -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    if echo "$routes" | jq -e '.items | length > 0' >/dev/null; then
        echo ""
        echo "Routes:"
        echo "$routes" | jq -r '.items[] | "\(.metadata.name): https://\(.spec.host)"'
    fi
    
    # Display access instructions
    echo ""
    echo "Access Instructions:"
    echo "==================="
    
    local app_route
    app_route=$(oc get route nanopore-tracking-app -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    
    if [ -n "$app_route" ]; then
        echo "Application: https://$app_route"
        echo "Service Mesh Health: https://$app_route/api/service-mesh/health"
        echo "Service Mesh Metrics: https://$app_route/api/service-mesh/metrics"
        echo "Performance API: https://$app_route/api/performance/load-test"
        echo "Security API: https://$app_route/api/security/hardening"
    else
        echo "Application route not found. Use port-forwarding:"
        echo "oc port-forward -n $NAMESPACE svc/nanopore-tracking-service 3001:3001"
    fi
    
    # Prometheus access
    local prometheus_pod
    prometheus_pod=$(oc get pods -n "$NAMESPACE" -l app=prometheus -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$prometheus_pod" ]; then
        echo ""
        echo "Prometheus (port-forward required):"
        echo "oc port-forward -n $NAMESPACE $prometheus_pod 9090:9090"
        echo "Then access: http://localhost:9090"
    fi
}

# Function to cleanup on failure
cleanup_on_failure() {
    log_warning "Cleaning up due to failure..."
    
    # Remove any partially deployed resources
    oc delete -f "$DEPLOYMENT_DIR/security-hardening.yaml" --ignore-not-found=true
    oc delete -f "$DEPLOYMENT_DIR/enhanced-monitoring.yaml" --ignore-not-found=true
    oc delete -f "$DEPLOYMENT_DIR/quota-optimized-service-mesh.yaml" --ignore-not-found=true
    oc delete -f "$DEPLOYMENT_DIR/service-account.yaml" --ignore-not-found=true
    
    log_info "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting complete service mesh solution deployment..."
    log_info "Phases 4 & 5: Performance Optimization and Security Hardening"
    
    # Set up error handling
    trap cleanup_on_failure ERR
    
    # Run deployment steps
    check_prerequisites
    check_quotas
    
    # Deploy in order
    deploy_service_account
    deploy_security_hardening
    deploy_enhanced_monitoring
    deploy_quota_optimized_service_mesh
    deploy_prometheus
    
    # Wait a bit for everything to stabilize
    log_info "Waiting for deployments to stabilize..."
    sleep 30
    
    # Run health checks
    run_health_checks
    
    # Run performance tests
    run_performance_tests
    
    # Display summary
    display_summary
    
    log_success "Complete service mesh solution deployment completed successfully!"
    log_info "Phase 4 (Performance Optimization) and Phase 5 (Security Hardening) are now active"
}

# Run main function
main "$@" 