#!/bin/bash

# Namespace-Scoped Service Deployment Script
# Works within existing namespace permissions without cluster-level resources

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
    
    # Check if logged in to OpenShift
    if ! oc whoami >/dev/null 2>&1; then
        log_error "Not logged in to OpenShift. Please run 'oc login' first"
        exit 1
    fi
    
    # Check if namespace exists and is accessible
    if ! oc get namespace "$NAMESPACE" >/dev/null 2>&1; then
        log_error "Namespace '$NAMESPACE' does not exist or is not accessible"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to check resource quotas
check_resource_quotas() {
    log_info "Checking resource quotas..."
    
    # Get current resource usage
    local quotas=$(oc get resourcequota -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    
    if [[ $(echo "$quotas" | jq '.items | length') -gt 0 ]]; then
        echo "$quotas" | jq -r '.items[] | "\(.metadata.name): \(.status.used) / \(.status.hard)"'
        
        # Check pod quota
        local used_pods=$(echo "$quotas" | jq -r '.items[] | select(.status.used.pods) | .status.used.pods' | head -1)
        local hard_pods=$(echo "$quotas" | jq -r '.items[] | select(.status.hard.pods) | .status.hard.pods' | head -1)
        
        if [[ -n "$used_pods" && -n "$hard_pods" ]]; then
            log_info "Pods: $used_pods/$hard_pods"
            if [[ $used_pods -ge $hard_pods ]]; then
                log_error "Pod quota exceeded. Cannot deploy more pods."
                exit 1
            fi
        fi
        
        # Check service quota
        local used_services=$(echo "$quotas" | jq -r '.items[] | select(.status.used.services) | .status.used.services' | head -1)
        local hard_services=$(echo "$quotas" | jq -r '.items[] | select(.status.hard.services) | .status.hard.services' | head -1)
        
        if [[ -n "$used_services" && -n "$hard_services" ]]; then
            log_info "Services: $used_services/$hard_services"
            if [[ $used_services -ge $hard_services ]]; then
                log_error "Service quota exceeded. Cannot deploy more services."
                exit 1
            fi
        fi
    else
        log_info "No resource quotas found"
    fi
}

# Function to deploy namespace-scoped RBAC
deploy_rbac() {
    log_info "Deploying namespace-scoped RBAC..."
    
    if oc apply -f "${DEPLOYMENT_DIR}/service-account-namespace-scoped.yaml" -n "$NAMESPACE"; then
        log_success "RBAC deployed successfully"
    else
        log_error "Failed to deploy RBAC"
        return 1
    fi
}

# Function to deploy ConfigMap
deploy_configmap() {
    log_info "Deploying ConfigMap..."
    
    if [[ -f "${DEPLOYMENT_DIR}/configmap.yaml" ]]; then
        if oc apply -f "${DEPLOYMENT_DIR}/configmap.yaml" -n "$NAMESPACE"; then
            log_success "ConfigMap deployed successfully"
        else
            log_error "Failed to deploy ConfigMap"
            return 1
        fi
    else
        log_warning "ConfigMap file not found, skipping..."
    fi
}

# Function to deploy main application
deploy_application() {
    log_info "Deploying main application..."
    
    if [[ -f "${DEPLOYMENT_DIR}/deployment.yaml" ]]; then
        if oc apply -f "${DEPLOYMENT_DIR}/deployment.yaml" -n "$NAMESPACE"; then
            log_success "Application deployed successfully"
        else
            log_error "Failed to deploy application"
            return 1
        fi
    else
        log_error "Application deployment file not found"
        return 1
    fi
}

# Function to deploy services
deploy_services() {
    log_info "Deploying services..."
    
    # Deploy each service file if it exists, but skip problematic ones
    for service_file in "${DEPLOYMENT_DIR}"/*service*.yaml; do
        if [[ -f "$service_file" ]]; then
            local service_name=$(basename "$service_file")
            
            # Skip problematic files
            if [[ "$service_name" == "microservices-deployment.yaml" ]]; then
                log_warning "Skipping $service_name (namespace conflict)"
                continue
            fi
            
            # Skip files with monitoring resources that require special permissions
            if [[ "$service_name" == "quota-optimized-service-mesh.yaml" || 
                  "$service_name" == "service-mesh-integration.yaml" || 
                  "$service_name" == "enhanced-monitoring.yaml" || 
                  "$service_name" == "security-hardening.yaml" || 
                  "$service_name" == "service-account.yaml" || 
                  "$service_name" == "service-mesh.yaml" || 
                  "$service_name" == "monitoring.yaml" ]]; then
                log_warning "Skipping $service_name (requires cluster permissions or too many services)"
                continue
            fi
            
            log_info "Deploying $service_name..."
            
            if oc apply -f "$service_file" -n "$NAMESPACE"; then
                log_success "$service_name deployed successfully"
            else
                log_error "Failed to deploy $service_name"
                return 1
            fi
        fi
    done
}

# Function to wait for deployment readiness
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    
    local deployment_name="${APP_NAME}"
    local max_wait=300  # 5 minutes
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if oc get deployment "$deployment_name" -n "$NAMESPACE" >/dev/null 2>&1; then
            local ready=$(oc get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired=$(oc get deployment "$deployment_name" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
            
            if [[ "$ready" == "$desired" && "$ready" != "0" ]]; then
                log_success "Deployment is ready ($ready/$desired replicas)"
                return 0
            fi
            
            log_info "Waiting for deployment... ($ready/$desired replicas ready)"
        else
            log_info "Waiting for deployment to be created..."
        fi
        
        sleep 10
        ((wait_time += 10))
    done
    
    log_error "Deployment did not become ready within $max_wait seconds"
    return 1
}

# Function to show deployment status
show_status() {
    log_info "Deployment Status:"
    
    echo "Pods:"
    oc get pods -n "$NAMESPACE" -l app="$APP_NAME" 2>/dev/null || echo "No pods found"
    
    echo -e "\nServices:"
    oc get services -n "$NAMESPACE" -l app="$APP_NAME" 2>/dev/null || echo "No services found"
    
    echo -e "\nDeployments:"
    oc get deployments -n "$NAMESPACE" -l app="$APP_NAME" 2>/dev/null || echo "No deployments found"
}

# Function to cleanup on failure
cleanup() {
    log_warning "Cleaning up due to failure..."
    
    # Remove application resources
    oc delete all -l app="$APP_NAME" -n "$NAMESPACE" 2>/dev/null || true
    
    # Remove ConfigMap
    oc delete configmap -l app="$APP_NAME" -n "$NAMESPACE" 2>/dev/null || true
    
    # Remove RBAC (but keep service account for future use)
    # oc delete rolebinding nanopore-tracking-rolebinding -n "$NAMESPACE" 2>/dev/null || true
    # oc delete role nanopore-tracking-role -n "$NAMESPACE" 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting namespace-scoped deployment..."
    log_info "Target namespace: $NAMESPACE"
    
    # Trap for cleanup on failure
    trap cleanup ERR
    
    # Run deployment steps
    check_prerequisites
    check_resource_quotas
    deploy_rbac
    deploy_configmap
    deploy_application
    deploy_services
    wait_for_deployment
    show_status
    
    log_success "Deployment completed successfully!"
    log_info "Use 'oc get pods -n $NAMESPACE' to check pod status"
    log_info "Use 'oc logs -f deployment/$APP_NAME -n $NAMESPACE' to view logs"
}

# Run main function
main "$@" 