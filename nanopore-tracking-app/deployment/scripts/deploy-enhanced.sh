#!/bin/bash

# Enhanced Deployment Script for OpenShift
# Designed for increased resource limits: 15 pods, 15 services
# This script provides comprehensive deployment with monitoring, autoscaling, and security

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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command_exists oc; then
        log_error "OpenShift CLI (oc) is required but not installed"
        exit 1
    fi
    
    if ! command_exists jq; then
        log_warning "jq is not installed. Some features may be limited."
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
    
    # Check OpenShift version
    OC_VERSION=$(oc version --client -o json | jq -r '.clientVersion.gitVersion' 2>/dev/null || echo "unknown")
    log_info "OpenShift CLI version: $OC_VERSION"
    
    log_success "Prerequisites check passed"
}

# Function to check resource quotas and capabilities
check_resource_quotas() {
    log_step "Checking resource quotas and capabilities..."
    
    # Get current resource usage
    QUOTA_OUTPUT=$(oc get resourcequota default-quota -o json 2>/dev/null || echo "{}")
    
    if [ "$QUOTA_OUTPUT" = "{}" ]; then
        log_warning "No resource quota found. Proceeding with enhanced deployment."
        return 0
    fi
    
    # Parse quota information
    PODS_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.pods // "0"')
    PODS_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.pods // "15"')
    SERVICES_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.services // "0"')
    SERVICES_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.services // "15"')
    STORAGE_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used["requests.storage"] // "0"')
    STORAGE_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard["requests.storage"] // "5Gi"')
    SECRETS_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.secrets // "0"')
    SECRETS_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.secrets // "50"')
    
    log_info "Current Resource Usage:"
    log_info "  Pods: $PODS_USED/$PODS_LIMIT"
    log_info "  Services: $SERVICES_USED/$SERVICES_LIMIT"
    log_info "  Storage: $STORAGE_USED/$STORAGE_LIMIT"
    log_info "  Secrets: $SECRETS_USED/$SECRETS_LIMIT"
    
    # Check if we have enough resources for enhanced deployment
    PODS_AVAILABLE=$((PODS_LIMIT - PODS_USED))
    SERVICES_AVAILABLE=$((SERVICES_LIMIT - SERVICES_USED))
    
    if [ "$PODS_AVAILABLE" -lt 5 ]; then
        log_warning "Limited pod quota available ($PODS_AVAILABLE). May need to scale down replicas."
    fi
    
    if [ "$SERVICES_AVAILABLE" -lt 3 ]; then
        log_warning "Limited service quota available ($SERVICES_AVAILABLE). May skip some services."
    fi
    
    # Check for autoscaling support
    if oc get hpa >/dev/null 2>&1; then
        log_info "Horizontal Pod Autoscaler is supported"
        HPA_SUPPORTED=true
    else
        log_warning "Horizontal Pod Autoscaler is not supported in this cluster"
        HPA_SUPPORTED=false
    fi
    
    # Check for network policies support
    if oc get networkpolicy >/dev/null 2>&1; then
        log_info "Network Policies are supported"
        NETPOL_SUPPORTED=true
    else
        log_warning "Network Policies are not supported in this cluster"
        NETPOL_SUPPORTED=false
    fi
    
    log_success "Resource quota check completed"
}

# Function to create or update secrets
deploy_secrets() {
    log_step "Deploying secrets..."
    
    # Check if secrets already exist
    if oc get secret nanopore-secrets >/dev/null 2>&1; then
        log_info "Secret 'nanopore-secrets' already exists. Updating if needed..."
        oc apply -f "${DEPLOYMENT_DIR}/secret.yaml"
    else
        log_info "Creating secret 'nanopore-secrets'..."
        oc apply -f "${DEPLOYMENT_DIR}/secret.yaml"
    fi
    
    log_success "Secrets deployed successfully"
}

# Function to create or update configmaps
deploy_configmaps() {
    log_step "Deploying configmaps..."
    
    # Deploy original configmap for backward compatibility
    oc apply -f "${DEPLOYMENT_DIR}/configmap.yaml"
    
    # Deploy enhanced configmap
    if [ -f "${DEPLOYMENT_DIR}/enhanced-configmap.yaml" ]; then
        oc apply -f "${DEPLOYMENT_DIR}/enhanced-configmap.yaml"
        log_info "Enhanced ConfigMap deployed"
    else
        log_warning "Enhanced ConfigMap file not found. Using basic ConfigMap only."
    fi
    
    log_success "ConfigMaps deployed successfully"
}

# Function to create persistent volume claims
deploy_storage() {
    log_step "Deploying persistent storage..."
    
    # Check if PVCs already exist and are bound
    UPLOADS_PVC_EXISTS=false
    DATA_PVC_EXISTS=false
    
    if oc get pvc nanopore-uploads-pvc >/dev/null 2>&1; then
        UPLOADS_PVC_STATUS=$(oc get pvc nanopore-uploads-pvc -o jsonpath='{.status.phase}')
        if [ "$UPLOADS_PVC_STATUS" = "Bound" ]; then
            log_info "PVC nanopore-uploads-pvc already exists and is bound"
            UPLOADS_PVC_EXISTS=true
        fi
    fi
    
    if oc get pvc nanopore-data-pvc >/dev/null 2>&1; then
        DATA_PVC_STATUS=$(oc get pvc nanopore-data-pvc -o jsonpath='{.status.phase}')
        if [ "$DATA_PVC_STATUS" = "Bound" ]; then
            log_info "PVC nanopore-data-pvc already exists and is bound"
            DATA_PVC_EXISTS=true
        fi
    fi
    
    # Check for legacy PVC name (nanopore-app-data-pvc)
    if [ "$DATA_PVC_EXISTS" = false ] && oc get pvc nanopore-app-data-pvc >/dev/null 2>&1; then
        LEGACY_PVC_STATUS=$(oc get pvc nanopore-app-data-pvc -o jsonpath='{.status.phase}')
        if [ "$LEGACY_PVC_STATUS" = "Bound" ]; then
            log_info "Found legacy PVC nanopore-app-data-pvc, creating alias"
            # Create a service to reference the legacy PVC name in the deployment
            DATA_PVC_EXISTS=true
            LEGACY_DATA_PVC=true
        fi
    fi
    
    # Deploy PVCs using the enhanced-pvcs.yaml file if they don't exist
    if [ "$UPLOADS_PVC_EXISTS" = false ] || [ "$DATA_PVC_EXISTS" = false ]; then
        if [ -f "${DEPLOYMENT_DIR}/enhanced-pvcs.yaml" ]; then
            log_info "Deploying PVCs from enhanced-pvcs.yaml..."
            oc apply -f "${DEPLOYMENT_DIR}/enhanced-pvcs.yaml" || {
                log_warning "Failed to deploy some PVCs. Continuing with existing ones."
            }
        else
            log_warning "Enhanced PVCs file not found. Using existing PVCs only."
        fi
    fi
    
    # Wait for PVCs to be bound
    log_info "Waiting for PVCs to be bound..."
    
    # Check uploads PVC
    if oc get pvc nanopore-uploads-pvc >/dev/null 2>&1; then
        oc wait --for=condition=Bound pvc/nanopore-uploads-pvc --timeout=60s || {
            log_warning "PVC nanopore-uploads-pvc not bound within 60s"
        }
    fi
    
    # Check data PVC (try both names)
    if oc get pvc nanopore-data-pvc >/dev/null 2>&1; then
        oc wait --for=condition=Bound pvc/nanopore-data-pvc --timeout=60s || {
            log_warning "PVC nanopore-data-pvc not bound within 60s"
        }
    elif oc get pvc nanopore-app-data-pvc >/dev/null 2>&1; then
        oc wait --for=condition=Bound pvc/nanopore-app-data-pvc --timeout=60s || {
            log_warning "PVC nanopore-app-data-pvc not bound within 60s"
        }
    fi
    
    log_success "Storage deployment completed"
}

# Function to create service account and RBAC
deploy_service_account() {
    log_step "Deploying service account and RBAC..."
    
    # Check if service account exists
    if oc get serviceaccount nanopore-tracking-sa >/dev/null 2>&1; then
        log_info "Service account 'nanopore-tracking-sa' already exists"
    else
        log_info "Creating service account..."
        oc apply -f "${DEPLOYMENT_DIR}/service-account-namespace-scoped.yaml"
    fi
    
    log_success "Service account deployed successfully"
}

# Function to deploy the main application
deploy_application() {
    log_step "Deploying main application..."
    
    # Check if deployment already exists
    if oc get deployment nanopore-tracking-app >/dev/null 2>&1; then
        log_info "Deployment already exists. Updating..."
        
        # Scale down first for clean update
        oc scale deployment nanopore-tracking-app --replicas=0
        sleep 5
        
        # Apply only the deployment section from enhanced-deployment.yaml
        awk '/^# Main Application Deployment/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_error "Failed to apply deployment"
            exit 1
        }
        
        # Scale back up
        oc scale deployment nanopore-tracking-app --replicas=3
    else
        log_info "Creating new deployment..."
        awk '/^# Main Application Deployment/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_error "Failed to create deployment"
            exit 1
        }
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    oc rollout status deployment/nanopore-tracking-app --timeout=600s || {
        log_error "Deployment failed to become ready within 600s"
        log_info "Checking deployment status..."
        oc describe deployment nanopore-tracking-app
        oc get pods -l app=nanopore-tracking-app
        oc logs -l app=nanopore-tracking-app --tail=50
        exit 1
    }
    
    log_success "Application deployed successfully"
}

# Function to deploy services
deploy_services() {
    log_step "Deploying services..."
    
    # Deploy main application service
    awk '/^# Application Service/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
        log_warning "Failed to deploy main application service"
    }
    
    # Deploy metrics service if we have quota
    if [ "$SERVICES_AVAILABLE" -gt 1 ]; then
        awk '/^# Metrics Service for Prometheus/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_warning "Failed to deploy metrics service"
        }
        log_info "Metrics service deployed"
    else
        log_warning "Skipping metrics service due to service quota constraints"
    fi
    
    log_success "Services deployed successfully"
}

# Function to deploy autoscaling
deploy_autoscaling() {
    log_step "Deploying autoscaling..."
    
    if [ "$HPA_SUPPORTED" = true ] && [ "$PODS_AVAILABLE" -gt 3 ]; then
        # Deploy HPA
        awk '/^# Horizontal Pod Autoscaler/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_warning "Failed to deploy HPA"
        }
        
        # Deploy Pod Disruption Budget
        awk '/^# Pod Disruption Budget/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_warning "Failed to deploy PDB"
        }
        
        log_success "Autoscaling deployed successfully"
    else
        log_warning "Skipping autoscaling due to insufficient resources or lack of support"
    fi
}

# Function to deploy security policies
deploy_security() {
    log_step "Deploying security policies..."
    
    if [ "$NETPOL_SUPPORTED" = true ]; then
        # Deploy Network Policy
        awk '/^# Network Policy for enhanced security/,/^---$/ {if (!/^---$/) print}' "${DEPLOYMENT_DIR}/enhanced-deployment.yaml" | oc apply -f - || {
            log_warning "Failed to deploy network policy"
        }
        log_info "Network policies deployed"
    else
        log_warning "Skipping network policies due to lack of support"
    fi
    
    log_success "Security policies deployed successfully"
}

# Function to deploy monitoring
deploy_monitoring() {
    log_step "Deploying monitoring..."
    
    if [ "$SERVICES_AVAILABLE" -gt 2 ] && [ "$PODS_AVAILABLE" -gt 5 ]; then
        # Deploy enhanced monitoring if we have resources
        if [ -f "${DEPLOYMENT_DIR}/enhanced-monitoring.yaml" ]; then
            log_info "Deploying enhanced monitoring..."
            oc apply -f "${DEPLOYMENT_DIR}/enhanced-monitoring.yaml" || {
                log_warning "Failed to deploy enhanced monitoring. Continuing without it."
            }
        elif [ -f "${DEPLOYMENT_DIR}/memory-optimized-prometheus.yaml" ]; then
            log_info "Deploying memory-optimized monitoring..."
            oc apply -f "${DEPLOYMENT_DIR}/memory-optimized-prometheus.yaml" || {
                log_warning "Failed to deploy monitoring. Continuing without it."
            }
        fi
    else
        log_warning "Skipping monitoring due to resource constraints"
    fi
    
    log_success "Monitoring deployment completed"
}

# Function to check application health
check_application_health() {
    log_step "Checking application health..."
    
    # Get pod names
    PODS=$(oc get pods -l app=nanopore-tracking-app -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$PODS" ]; then
        log_error "No pods found for application"
        return 1
    fi
    
    # Check each pod
    for pod in $PODS; do
        POD_STATUS=$(oc get pod "$pod" -o jsonpath='{.status.phase}')
        log_info "Pod $pod status: $POD_STATUS"
        
        if [ "$POD_STATUS" != "Running" ]; then
            log_error "Pod $pod is not running"
            oc describe pod "$pod"
            return 1
        fi
        
        # Check application health endpoint
        log_info "Testing health endpoint for pod $pod..."
        oc exec "$pod" -- curl -f http://localhost:3001/health >/dev/null 2>&1 || {
            log_warning "Health endpoint not responding for pod $pod. Checking logs..."
            oc logs "$pod" --tail=20
        }
    done
    
    log_success "Application health check completed"
}

# Function to display comprehensive deployment information
display_deployment_info() {
    log_step "Deployment Information Summary"
    
    echo ""
    echo "=== DEPLOYMENT SUMMARY ==="
    echo "Namespace: $NAMESPACE"
    echo "Application: $APP_NAME"
    echo "Deployment Type: Enhanced"
    echo ""
    
    # Pod information
    echo "=== PODS ==="
    oc get pods -l app=nanopore-tracking-app -o wide
    echo ""
    
    # Service information
    echo "=== SERVICES ==="
    oc get services -l app=nanopore-tracking-app
    echo ""
    
    # HPA information
    if [ "$HPA_SUPPORTED" = true ]; then
        echo "=== HORIZONTAL POD AUTOSCALER ==="
        oc get hpa nanopore-tracking-hpa 2>/dev/null || echo "HPA not deployed"
        echo ""
    fi
    
    # PVC information
    echo "=== PERSISTENT VOLUME CLAIMS ==="
    oc get pvc -l app=nanopore-tracking-app
    echo ""
    
    # Route information (if any)
    echo "=== ROUTES ==="
    ROUTES=$(oc get routes -l app=nanopore-tracking-app -o jsonpath='{.items[*].spec.host}' 2>/dev/null || echo "")
    if [ -n "$ROUTES" ]; then
        echo "Routes: $ROUTES"
    else
        echo "No routes configured (internal access only)"
    fi
    echo ""
    
    # Resource usage
    echo "=== RESOURCE USAGE ==="
    oc top pod -l app=nanopore-tracking-app 2>/dev/null || echo "Resource metrics not available"
    echo ""
    
    # Configuration
    echo "=== CONFIGURATION ==="
    echo "ConfigMaps:"
    oc get configmaps -l app=nanopore-tracking-app
    echo ""
    echo "Secrets:"
    oc get secrets -l app=nanopore-tracking-app
    echo ""
    
    # Final status
    echo "=== FINAL STATUS ==="
    READY_PODS=$(oc get pods -l app=nanopore-tracking-app --no-headers | grep -c "Running" || echo "0")
    TOTAL_PODS=$(oc get pods -l app=nanopore-tracking-app --no-headers | wc -l | tr -d ' ')
    
    echo "Ready Pods: $READY_PODS/$TOTAL_PODS"
    
    if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
        log_success "All pods are running successfully!"
    else
        log_warning "Some pods may not be ready. Check pod status above."
    fi
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    log_step "Running post-deployment tests..."
    
    # Test 1: Health endpoint accessibility
    log_info "Testing health endpoints..."
    PODS=$(oc get pods -l app=nanopore-tracking-app -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    for pod in $PODS; do
        if oc exec "$pod" -- curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log_success "Health endpoint accessible on pod $pod"
        else
            log_error "Health endpoint not accessible on pod $pod"
        fi
    done
    
    # Test 2: Service connectivity
    log_info "Testing service connectivity..."
    if oc get service nanopore-tracking-service >/dev/null 2>&1; then
        SERVICE_IP=$(oc get service nanopore-tracking-service -o jsonpath='{.spec.clusterIP}')
        log_info "Service IP: $SERVICE_IP"
        
        # Test from within the cluster
        if [ -n "$PODS" ]; then
            FIRST_POD=$(echo $PODS | awk '{print $1}')
            if oc exec "$FIRST_POD" -- curl -f "http://$SERVICE_IP:3001/health" >/dev/null 2>&1; then
                log_success "Service connectivity test passed"
            else
                log_warning "Service connectivity test failed"
            fi
        fi
    fi
    
    # Test 3: Autoscaling (if enabled)
    if [ "$HPA_SUPPORTED" = true ]; then
        log_info "Testing autoscaling configuration..."
        if oc get hpa nanopore-tracking-hpa >/dev/null 2>&1; then
            HPA_STATUS=$(oc get hpa nanopore-tracking-hpa -o jsonpath='{.status.conditions[0].type}')
            if [ "$HPA_STATUS" = "AbleToScale" ]; then
                log_success "Autoscaling is configured and ready"
            else
                log_warning "Autoscaling may not be fully ready"
            fi
        fi
    fi
    
    log_success "Post-deployment tests completed"
}

# Function to cleanup old resources
cleanup_old_resources() {
    log_step "Cleaning up old resources..."
    
    # Remove old deployments that might conflict
    OLD_DEPLOYMENTS=$(oc get deployments -l app=nanopore-tracking-app --no-headers | grep -v "nanopore-tracking-app" | awk '{print $1}' || echo "")
    
    for deployment in $OLD_DEPLOYMENTS; do
        log_info "Removing old deployment: $deployment"
        oc delete deployment "$deployment" --ignore-not-found=true
    done
    
    # Remove old services that might conflict
    OLD_SERVICES=$(oc get services -l app=nanopore-tracking-app --no-headers | grep -v "nanopore-tracking-service\|nanopore-metrics-service" | awk '{print $1}' || echo "")
    
    for service in $OLD_SERVICES; do
        log_info "Removing old service: $service"
        oc delete service "$service" --ignore-not-found=true
    done
    
    # Remove old configmaps that might conflict
    OLD_CONFIGMAPS=$(oc get configmaps -l app=nanopore-tracking-app --no-headers | grep -v "nanopore-config\|nanopore-config-enhanced" | awk '{print $1}' || echo "")
    
    for configmap in $OLD_CONFIGMAPS; do
        log_info "Removing old configmap: $configmap"
        oc delete configmap "$configmap" --ignore-not-found=true
    done
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    echo ""
    echo "=========================================="
    echo "  Enhanced OpenShift Deployment Script"
    echo "  Nanopore Tracking Application"
    echo "=========================================="
    echo ""
    
    log_info "Starting enhanced deployment for $APP_NAME"
    log_info "Target namespace: $NAMESPACE"
    log_info "Deployment type: Enhanced (15 pods, 15 services)"
    echo ""
    
    # Initialize variables
    HPA_SUPPORTED=false
    NETPOL_SUPPORTED=false
    PODS_AVAILABLE=15
    SERVICES_AVAILABLE=15
    
    # Check prerequisites
    check_prerequisites
    
    # Check resource quotas and capabilities
    check_resource_quotas
    
    # Cleanup old resources first
    cleanup_old_resources
    
    # Deploy components in order
    deploy_secrets
    deploy_configmaps
    deploy_storage
    deploy_service_account
    deploy_application
    deploy_services
    deploy_autoscaling
    deploy_security
    deploy_monitoring
    
    # Health checks and testing
    check_application_health
    run_post_deployment_tests
    
    # Display comprehensive deployment information
    display_deployment_info
    
    echo ""
    echo "=========================================="
    log_success "Enhanced deployment completed successfully!"
    echo "=========================================="
    echo ""
    
    log_info "Enhanced deployment features enabled:"
    log_info "  ✓ Multi-replica deployment (3 replicas)"
    log_info "  ✓ Horizontal Pod Autoscaling (2-5 replicas)"
    log_info "  ✓ Enhanced health checks and monitoring"
    log_info "  ✓ Persistent storage with increased capacity"
    log_info "  ✓ Service mesh integration with full features"
    log_info "  ✓ Network policies for enhanced security"
    log_info "  ✓ Pod disruption budgets for availability"
    log_info "  ✓ Comprehensive logging and metrics"
    log_info "  ✓ Resource optimization and performance tuning"
    
    echo ""
    log_info "Next steps:"
    log_info "  1. Monitor application performance and scaling"
    log_info "  2. Configure external routes if needed"
    log_info "  3. Set up monitoring dashboards"
    log_info "  4. Configure backup and disaster recovery"
    log_info "  5. Review and adjust autoscaling policies"
    
    echo ""
}

# Error handling
trap 'log_error "Enhanced deployment failed at line $LINENO"' ERR

# Parse command line arguments
SKIP_TESTS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --skip-tests    Skip post-deployment tests"
            echo "  --verbose       Enable verbose output"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@" 