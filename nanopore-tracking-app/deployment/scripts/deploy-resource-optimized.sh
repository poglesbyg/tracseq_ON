#!/bin/bash

# Resource-Optimized Deployment Script for OpenShift
# Designed for quota constraints: 1 pod available, 0 services available
# This script deploys the nanopore tracking app in a resource-efficient manner

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
    
    if ! oc whoami >/dev/null 2>&1; then
        log_error "Not logged into OpenShift. Please run 'oc login'"
        exit 1
    fi
    
    # Check if we're in the correct namespace
    CURRENT_PROJECT=$(oc project -q 2>/dev/null || echo "")
    if [ "$CURRENT_PROJECT" != "$NAMESPACE" ]; then
        log_warning "Switching to namespace: $NAMESPACE"
        oc project "$NAMESPACE" || {
            log_error "Failed to switch to namespace $NAMESPACE"
            exit 1
        }
    fi
    
    log_success "Prerequisites check passed"
}

# Function to check resource quotas
check_resource_quotas() {
    log_info "Checking resource quotas..."
    
    # Get current resource usage
    QUOTA_OUTPUT=$(oc get resourcequota default-quota -o json 2>/dev/null || echo "{}")
    
    if [ "$QUOTA_OUTPUT" = "{}" ]; then
        log_warning "No resource quota found. Proceeding with deployment."
        return 0
    fi
    
    # Parse quota information
    PODS_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.pods // "0"')
    PODS_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.pods // "10"')
    SERVICES_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.services // "0"')
    SERVICES_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.services // "10"')
    STORAGE_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used["requests.storage"] // "0"')
    STORAGE_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard["requests.storage"] // "5Gi"')
    
    log_info "Resource Usage:"
    log_info "  Pods: $PODS_USED/$PODS_LIMIT"
    log_info "  Services: $SERVICES_USED/$SERVICES_LIMIT"
    log_info "  Storage: $STORAGE_USED/$STORAGE_LIMIT"
    
    # Check if we have enough resources
    PODS_AVAILABLE=$((PODS_LIMIT - PODS_USED))
    SERVICES_AVAILABLE=$((SERVICES_LIMIT - SERVICES_USED))
    
    if [ "$PODS_AVAILABLE" -lt 1 ]; then
        log_error "Not enough pod quota available. Need 1, have $PODS_AVAILABLE"
        exit 1
    fi
    
    if [ "$SERVICES_AVAILABLE" -lt 0 ]; then
        log_warning "No service quota available. Using existing services only."
    fi
    
    log_success "Resource quota check passed"
}

# Function to create or update secrets
deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets already exist
    if oc get secret nanopore-secrets >/dev/null 2>&1; then
        log_info "Secret 'nanopore-secrets' already exists. Skipping creation."
    else
        log_info "Creating secret 'nanopore-secrets'..."
        oc apply -f "${DEPLOYMENT_DIR}/secret.yaml"
        log_success "Secret created successfully"
    fi
}

# Function to create or update configmaps
deploy_configmaps() {
    log_info "Deploying configmaps..."
    
    # Deploy original configmap
    oc apply -f "${DEPLOYMENT_DIR}/configmap.yaml"
    
    # Deploy optimized configmap
    oc apply -f "${DEPLOYMENT_DIR}/resource-optimized-deployment.yaml" | grep -A 50 "ConfigMap"
    
    log_success "ConfigMaps deployed successfully"
}

# Function to create persistent volume claims
deploy_storage() {
    log_info "Deploying persistent storage..."
    
    # Extract and apply PVC definitions from the resource-optimized deployment
    oc apply -f "${DEPLOYMENT_DIR}/resource-optimized-deployment.yaml" | grep -A 20 "PersistentVolumeClaim"
    
    # Wait for PVCs to be bound
    log_info "Waiting for PVCs to be bound..."
    oc wait --for=condition=Bound pvc/nanopore-uploads-pvc --timeout=60s || {
        log_warning "PVC nanopore-uploads-pvc not bound within 60s"
    }
    oc wait --for=condition=Bound pvc/nanopore-data-pvc --timeout=60s || {
        log_warning "PVC nanopore-data-pvc not bound within 60s"
    }
    
    log_success "Storage deployed successfully"
}

# Function to create service account
deploy_service_account() {
    log_info "Deploying service account..."
    
    # Check if service account exists
    if oc get serviceaccount nanopore-tracking-sa >/dev/null 2>&1; then
        log_info "Service account 'nanopore-tracking-sa' already exists"
    else
        log_info "Creating service account..."
        oc apply -f "${DEPLOYMENT_DIR}/service-account-namespace-scoped.yaml"
        log_success "Service account created successfully"
    fi
}

# Function to deploy the application
deploy_application() {
    log_info "Deploying application..."
    
    # Check if deployment already exists
    if oc get deployment nanopore-tracking-app >/dev/null 2>&1; then
        log_info "Deployment already exists. Updating..."
        oc apply -f "${DEPLOYMENT_DIR}/resource-optimized-deployment.yaml" | grep -A 100 "Deployment"
    else
        log_info "Creating new deployment..."
        oc apply -f "${DEPLOYMENT_DIR}/resource-optimized-deployment.yaml" | grep -A 100 "Deployment"
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    oc rollout status deployment/nanopore-tracking-app --timeout=300s || {
        log_error "Deployment failed to become ready within 300s"
        log_info "Checking deployment status..."
        oc describe deployment nanopore-tracking-app
        oc get pods -l app=nanopore-tracking-app
        exit 1
    }
    
    log_success "Application deployed successfully"
}

# Function to check application health
check_application_health() {
    log_info "Checking application health..."
    
    # Get pod name
    POD_NAME=$(oc get pods -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$POD_NAME" ]; then
        log_error "No pod found for application"
        return 1
    fi
    
    # Check pod status
    POD_STATUS=$(oc get pod "$POD_NAME" -o jsonpath='{.status.phase}')
    log_info "Pod status: $POD_STATUS"
    
    if [ "$POD_STATUS" != "Running" ]; then
        log_error "Pod is not running"
        oc describe pod "$POD_NAME"
        return 1
    fi
    
    # Check application health endpoint
    log_info "Testing health endpoint..."
    oc exec "$POD_NAME" -- curl -f http://localhost:3001/health >/dev/null 2>&1 || {
        log_warning "Health endpoint not responding. Checking logs..."
        oc logs "$POD_NAME" --tail=20
        return 1
    }
    
    log_success "Application health check passed"
}

# Function to display deployment information
display_deployment_info() {
    log_info "Deployment Information:"
    
    # Get pod information
    POD_NAME=$(oc get pods -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$POD_NAME" ]; then
        POD_IP=$(oc get pod "$POD_NAME" -o jsonpath='{.status.podIP}')
        NODE_NAME=$(oc get pod "$POD_NAME" -o jsonpath='{.spec.nodeName}')
        
        echo "  Pod Name: $POD_NAME"
        echo "  Pod IP: $POD_IP"
        echo "  Node: $NODE_NAME"
    fi
    
    # Get service information (if any)
    SERVICES=$(oc get services -l app=nanopore-tracking-app -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$SERVICES" ]; then
        echo "  Services: $SERVICES"
    else
        echo "  Services: None (using pod IP directly)"
    fi
    
    # Get route information (if any)
    ROUTES=$(oc get routes -l app=nanopore-tracking-app -o jsonpath='{.items[*].spec.host}' 2>/dev/null || echo "")
    if [ -n "$ROUTES" ]; then
        echo "  Routes: $ROUTES"
    else
        echo "  Routes: None (internal access only)"
    fi
    
    # Resource usage
    echo ""
    log_info "Resource Usage:"
    oc top pod -l app=nanopore-tracking-app 2>/dev/null || log_warning "Resource metrics not available"
}

# Function to setup monitoring (if resources allow)
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Check if we have resources for monitoring
    PODS_USED=$(oc get resourcequota default-quota -o jsonpath='{.status.used.pods}' 2>/dev/null || echo "0")
    PODS_LIMIT=$(oc get resourcequota default-quota -o jsonpath='{.status.hard.pods}' 2>/dev/null || echo "10")
    PODS_AVAILABLE=$((PODS_LIMIT - PODS_USED))
    
    if [ "$PODS_AVAILABLE" -lt 1 ]; then
        log_warning "Not enough pod quota for monitoring. Skipping monitoring setup."
        return 0
    fi
    
    # Deploy simple monitoring if resources allow
    if [ -f "${DEPLOYMENT_DIR}/simple-prometheus.yaml" ]; then
        log_info "Deploying simple monitoring..."
        oc apply -f "${DEPLOYMENT_DIR}/simple-prometheus.yaml" || {
            log_warning "Failed to deploy monitoring. Continuing without monitoring."
        }
    fi
    
    log_success "Monitoring setup completed"
}

# Function to cleanup old resources
cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    # Remove old deployments that might be using resources
    OLD_DEPLOYMENTS=$(oc get deployments -l app=nanopore-tracking-app --no-headers | grep -v nanopore-tracking-app | awk '{print $1}' || echo "")
    
    for deployment in $OLD_DEPLOYMENTS; do
        log_info "Removing old deployment: $deployment"
        oc delete deployment "$deployment" --ignore-not-found=true
    done
    
    # Remove old configmaps
    OLD_CONFIGMAPS=$(oc get configmaps -l app=nanopore-tracking-app --no-headers | grep -v nanopore-config | awk '{print $1}' || echo "")
    
    for configmap in $OLD_CONFIGMAPS; do
        log_info "Removing old configmap: $configmap"
        oc delete configmap "$configmap" --ignore-not-found=true
    done
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting resource-optimized deployment for $APP_NAME"
    
    # Check prerequisites
    check_prerequisites
    
    # Check resource quotas
    check_resource_quotas
    
    # Cleanup old resources first
    cleanup_old_resources
    
    # Deploy components in order
    deploy_secrets
    deploy_configmaps
    deploy_storage
    deploy_service_account
    deploy_application
    
    # Health checks
    check_application_health
    
    # Setup monitoring if possible
    setup_monitoring
    
    # Display deployment information
    display_deployment_info
    
    log_success "Resource-optimized deployment completed successfully!"
    log_info "Application is running in resource-constrained mode with:"
    log_info "  - Single pod deployment"
    log_info "  - Optimized memory usage (96-192Mi)"
    log_info "  - Integrated service mesh (no sidecar)"
    log_info "  - Persistent storage for uploads and data"
    log_info "  - Comprehensive health checks"
    log_info "  - Security hardening enabled"
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@" 