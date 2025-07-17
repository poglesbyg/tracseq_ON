#!/bin/bash

# Automatic OpenShift Deployment Script
# This script detects available resources and chooses the optimal deployment strategy
# - Resource-optimized deployment for constrained environments
# - Enhanced deployment for environments with ample resources

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
MAGENTA='\033[0;35m'
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

log_decision() {
    echo -e "${MAGENTA}[DECISION]${NC} $1"
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
        log_warning "jq is not installed. Using fallback resource detection."
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
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

# Function to analyze resource quotas and determine deployment strategy
analyze_resources() {
    log_step "Analyzing available resources..."
    
    # Get current resource usage
    QUOTA_OUTPUT=$(oc get resourcequota default-quota -o json 2>/dev/null || echo "{}")
    
    if [ "$QUOTA_OUTPUT" = "{}" ]; then
        log_warning "No resource quota found. Assuming enhanced deployment capability."
        DEPLOYMENT_STRATEGY="enhanced"
        return 0
    fi
    
    # Parse quota information
    if [ "$JQ_AVAILABLE" = true ]; then
        PODS_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.pods // "0"')
        PODS_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.pods // "10"')
        SERVICES_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.services // "0"')
        SERVICES_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.services // "10"')
        STORAGE_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used["requests.storage"] // "0"')
        STORAGE_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard["requests.storage"] // "5Gi"')
        SECRETS_USED=$(echo "$QUOTA_OUTPUT" | jq -r '.status.used.secrets // "0"')
        SECRETS_LIMIT=$(echo "$QUOTA_OUTPUT" | jq -r '.status.hard.secrets // "50"')
    else
        # Fallback parsing without jq
        PODS_USED=$(echo "$QUOTA_OUTPUT" | grep -o '"pods":"[^"]*"' | cut -d'"' -f4 || echo "0")
        PODS_LIMIT=$(echo "$QUOTA_OUTPUT" | grep -o '"pods":"[^"]*"' | cut -d'"' -f4 || echo "10")
        SERVICES_USED=$(echo "$QUOTA_OUTPUT" | grep -o '"services":"[^"]*"' | cut -d'"' -f4 || echo "0")
        SERVICES_LIMIT=$(echo "$QUOTA_OUTPUT" | grep -o '"services":"[^"]*"' | cut -d'"' -f4 || echo "10")
        STORAGE_USED="0"
        STORAGE_LIMIT="5Gi"
        SECRETS_USED="0"
        SECRETS_LIMIT="50"
    fi
    
    # Calculate available resources
    PODS_AVAILABLE=$((PODS_LIMIT - PODS_USED))
    SERVICES_AVAILABLE=$((SERVICES_LIMIT - SERVICES_USED))
    
    log_info "Current Resource Usage:"
    log_info "  Pods: $PODS_USED/$PODS_LIMIT (Available: $PODS_AVAILABLE)"
    log_info "  Services: $SERVICES_USED/$SERVICES_LIMIT (Available: $SERVICES_AVAILABLE)"
    log_info "  Storage: $STORAGE_USED/$STORAGE_LIMIT"
    log_info "  Secrets: $SECRETS_USED/$SECRETS_LIMIT"
    
    # Decision logic for deployment strategy
    if [ "$PODS_AVAILABLE" -ge 8 ] && [ "$SERVICES_AVAILABLE" -ge 5 ]; then
        DEPLOYMENT_STRATEGY="enhanced"
        log_decision "Enhanced deployment strategy selected"
        log_info "Rationale: Sufficient resources for multi-replica deployment with autoscaling"
    elif [ "$PODS_AVAILABLE" -ge 3 ] && [ "$SERVICES_AVAILABLE" -ge 2 ]; then
        DEPLOYMENT_STRATEGY="balanced"
        log_decision "Balanced deployment strategy selected"
        log_info "Rationale: Moderate resources available for basic scaling"
    elif [ "$PODS_AVAILABLE" -ge 1 ] && [ "$SERVICES_AVAILABLE" -ge 0 ]; then
        DEPLOYMENT_STRATEGY="resource-optimized"
        log_decision "Resource-optimized deployment strategy selected"
        log_info "Rationale: Limited resources require optimized single-pod deployment"
    else
        log_error "Insufficient resources for deployment"
        log_error "Required: At least 1 pod slot available"
        exit 1
    fi
    
    # Additional capability checks
    check_cluster_capabilities
    
    log_success "Resource analysis completed"
}

# Function to check cluster capabilities
check_cluster_capabilities() {
    log_step "Checking cluster capabilities..."
    
    # Check for autoscaling support
    if oc get hpa >/dev/null 2>&1; then
        log_info "✓ Horizontal Pod Autoscaler supported"
        HPA_SUPPORTED=true
    else
        log_warning "✗ Horizontal Pod Autoscaler not supported"
        HPA_SUPPORTED=false
    fi
    
    # Check for network policies support
    if oc get networkpolicy >/dev/null 2>&1; then
        log_info "✓ Network Policies supported"
        NETPOL_SUPPORTED=true
    else
        log_warning "✗ Network Policies not supported"
        NETPOL_SUPPORTED=false
    fi
    
    # Check for pod disruption budgets
    if oc get pdb >/dev/null 2>&1; then
        log_info "✓ Pod Disruption Budgets supported"
        PDB_SUPPORTED=true
    else
        log_warning "✗ Pod Disruption Budgets not supported"
        PDB_SUPPORTED=false
    fi
    
    # Check for service mesh capabilities
    if oc get service istio-system/istio-pilot >/dev/null 2>&1; then
        log_info "✓ Istio service mesh detected"
        SERVICE_MESH_TYPE="istio"
    elif oc get service openshift-service-mesh/istiod >/dev/null 2>&1; then
        log_info "✓ OpenShift Service Mesh detected"
        SERVICE_MESH_TYPE="openshift"
    else
        log_info "○ No service mesh detected - using integrated approach"
        SERVICE_MESH_TYPE="integrated"
    fi
    
    # Check for monitoring capabilities
    if oc get service prometheus-k8s -n openshift-monitoring >/dev/null 2>&1; then
        log_info "✓ OpenShift monitoring stack available"
        MONITORING_AVAILABLE=true
    else
        log_warning "○ OpenShift monitoring not available"
        MONITORING_AVAILABLE=false
    fi
    
    log_success "Cluster capabilities check completed"
}

# Function to display deployment strategy details
display_strategy_details() {
    log_step "Deployment Strategy Details"
    
    echo ""
    echo "=========================================="
    echo "  SELECTED DEPLOYMENT STRATEGY: $DEPLOYMENT_STRATEGY"
    echo "=========================================="
    echo ""
    
    case $DEPLOYMENT_STRATEGY in
        "enhanced")
            echo "Enhanced Deployment Features:"
            echo "  ✓ Multi-replica deployment (3 replicas)"
            echo "  ✓ Horizontal Pod Autoscaling (2-5 replicas)"
            echo "  ✓ Multiple services (app + metrics)"
            echo "  ✓ Enhanced persistent storage (2Gi each)"
            echo "  ✓ Pod disruption budgets"
            echo "  ✓ Network policies"
            echo "  ✓ Comprehensive monitoring"
            echo "  ✓ Service mesh integration"
            echo "  ✓ Advanced health checks"
            echo ""
            echo "Resource Requirements:"
            echo "  - Pods: 3-5 (plus monitoring)"
            echo "  - Services: 2-3"
            echo "  - Storage: 4Gi total"
            echo "  - Memory: ~1Gi total"
            ;;
        "balanced")
            echo "Balanced Deployment Features:"
            echo "  ✓ Dual-replica deployment (2 replicas)"
            echo "  ✓ Basic autoscaling (if supported)"
            echo "  ✓ Primary service"
            echo "  ✓ Standard persistent storage (1Gi each)"
            echo "  ✓ Basic health checks"
            echo "  ✓ Integrated service mesh"
            echo "  ○ Limited monitoring"
            echo ""
            echo "Resource Requirements:"
            echo "  - Pods: 2-3"
            echo "  - Services: 1-2"
            echo "  - Storage: 2Gi total"
            echo "  - Memory: ~512Mi total"
            ;;
        "resource-optimized")
            echo "Resource-Optimized Deployment Features:"
            echo "  ✓ Single-replica deployment (1 replica)"
            echo "  ✓ Minimal resource usage"
            echo "  ✓ Existing service reuse"
            echo "  ✓ Compact persistent storage (500Mi each)"
            echo "  ✓ Essential health checks"
            echo "  ✓ Integrated service mesh (no sidecar)"
            echo "  ○ Basic monitoring only"
            echo ""
            echo "Resource Requirements:"
            echo "  - Pods: 1"
            echo "  - Services: 0 (reuse existing)"
            echo "  - Storage: 1Gi total"
            echo "  - Memory: ~256Mi total"
            ;;
    esac
    
    echo ""
    echo "Cluster Capabilities:"
    echo "  - HPA Support: $HPA_SUPPORTED"
    echo "  - Network Policies: $NETPOL_SUPPORTED"
    echo "  - Pod Disruption Budgets: $PDB_SUPPORTED"
    echo "  - Service Mesh: $SERVICE_MESH_TYPE"
    echo "  - Monitoring: $MONITORING_AVAILABLE"
    echo ""
}

# Function to execute the selected deployment strategy
execute_deployment() {
    log_step "Executing deployment strategy: $DEPLOYMENT_STRATEGY"
    
    case $DEPLOYMENT_STRATEGY in
        "enhanced")
            if [ -f "${SCRIPT_DIR}/deploy-enhanced.sh" ]; then
                log_info "Executing enhanced deployment script..."
                bash "${SCRIPT_DIR}/deploy-enhanced.sh"
            else
                log_error "Enhanced deployment script not found"
                exit 1
            fi
            ;;
        "balanced")
            # For balanced deployment, use enhanced script with modified parameters
            if [ -f "${SCRIPT_DIR}/deploy-enhanced.sh" ]; then
                log_info "Executing balanced deployment (enhanced script with constraints)..."
                # Set environment variables to constrain the enhanced deployment
                export FORCE_REPLICAS=2
                export SKIP_MONITORING=true
                export LIMIT_SERVICES=true
                bash "${SCRIPT_DIR}/deploy-enhanced.sh"
            else
                log_error "Enhanced deployment script not found"
                exit 1
            fi
            ;;
        "resource-optimized")
            if [ -f "${SCRIPT_DIR}/deploy-resource-optimized.sh" ]; then
                log_info "Executing resource-optimized deployment script..."
                bash "${SCRIPT_DIR}/deploy-resource-optimized.sh"
            else
                log_error "Resource-optimized deployment script not found"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
            exit 1
            ;;
    esac
}

# Function to display post-deployment recommendations
display_recommendations() {
    log_step "Post-Deployment Recommendations"
    
    echo ""
    echo "=========================================="
    echo "  DEPLOYMENT COMPLETED SUCCESSFULLY!"
    echo "=========================================="
    echo ""
    
    case $DEPLOYMENT_STRATEGY in
        "enhanced")
            echo "Next Steps for Enhanced Deployment:"
            echo "  1. Monitor autoscaling behavior under load"
            echo "  2. Configure external routes for user access"
            echo "  3. Set up monitoring dashboards and alerts"
            echo "  4. Test disaster recovery procedures"
            echo "  5. Review and tune performance settings"
            echo "  6. Configure backup schedules"
            echo "  7. Set up log aggregation"
            echo ""
            echo "Monitoring Commands:"
            echo "  oc get hpa nanopore-tracking-hpa -w"
            echo "  oc top pods -l app=nanopore-tracking-app"
            echo "  oc get events --sort-by=.metadata.creationTimestamp"
            ;;
        "balanced")
            echo "Next Steps for Balanced Deployment:"
            echo "  1. Monitor resource usage and adjust if needed"
            echo "  2. Configure basic monitoring alerts"
            echo "  3. Test application functionality"
            echo "  4. Plan for future scaling if resources increase"
            echo "  5. Set up basic backup procedures"
            echo ""
            echo "Monitoring Commands:"
            echo "  oc get pods -l app=nanopore-tracking-app -w"
            echo "  oc top pods -l app=nanopore-tracking-app"
            echo "  oc logs -l app=nanopore-tracking-app -f"
            ;;
        "resource-optimized")
            echo "Next Steps for Resource-Optimized Deployment:"
            echo "  1. Monitor single pod performance closely"
            echo "  2. Plan for resource quota increases"
            echo "  3. Implement application-level caching"
            echo "  4. Test backup and recovery procedures"
            echo "  5. Monitor for resource pressure"
            echo ""
            echo "Monitoring Commands:"
            echo "  oc get pods -l app=nanopore-tracking-app -w"
            echo "  oc top pod -l app=nanopore-tracking-app"
            echo "  oc describe quota default-quota"
            echo "  oc logs -l app=nanopore-tracking-app -f"
            ;;
    esac
    
    echo ""
    echo "Common Troubleshooting Commands:"
    echo "  oc describe deployment nanopore-tracking-app"
    echo "  oc get events --sort-by=.metadata.creationTimestamp"
    echo "  oc logs -l app=nanopore-tracking-app --tail=100"
    echo "  oc get all -l app=nanopore-tracking-app"
    echo ""
    
    echo "Resource Upgrade Path:"
    if [ "$DEPLOYMENT_STRATEGY" = "resource-optimized" ]; then
        echo "  → Request quota increase to enable balanced deployment"
        echo "  → Current minimum for balanced: 3 pods, 2 services"
    fi
    if [ "$DEPLOYMENT_STRATEGY" = "balanced" ]; then
        echo "  → Request quota increase to enable enhanced deployment"
        echo "  → Current minimum for enhanced: 8 pods, 5 services"
    fi
    echo ""
}

# Main function
main() {
    echo ""
    echo "================================================"
    echo "  Automatic OpenShift Deployment Selector"
    echo "  Nanopore Tracking Application"
    echo "================================================"
    echo ""
    
    log_info "Starting automatic deployment for $APP_NAME"
    log_info "Target namespace: $NAMESPACE"
    echo ""
    
    # Initialize variables
    DEPLOYMENT_STRATEGY=""
    HPA_SUPPORTED=false
    NETPOL_SUPPORTED=false
    PDB_SUPPORTED=false
    SERVICE_MESH_TYPE="integrated"
    MONITORING_AVAILABLE=false
    JQ_AVAILABLE=true
    
    # Execute deployment pipeline
    check_prerequisites
    analyze_resources
    display_strategy_details
    
    # Confirm deployment strategy
    if [ "${AUTO_CONFIRM:-false}" != "true" ]; then
        echo ""
        read -p "Proceed with $DEPLOYMENT_STRATEGY deployment? [Y/n]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    execute_deployment
    display_recommendations
    
    echo ""
    log_success "Automatic deployment completed successfully!"
    echo ""
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Automatic OpenShift deployment script that selects the optimal"
    echo "deployment strategy based on available cluster resources."
    echo ""
    echo "Options:"
    echo "  --auto-confirm      Skip deployment confirmation prompt"
    echo "  --force-strategy    Force a specific deployment strategy"
    echo "                      (enhanced|balanced|resource-optimized)"
    echo "  --dry-run          Show selected strategy without deploying"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Interactive deployment"
    echo "  $0 --auto-confirm                    # Automatic deployment"
    echo "  $0 --force-strategy enhanced         # Force enhanced deployment"
    echo "  $0 --dry-run                         # Show strategy only"
    echo ""
}

# Error handling
trap 'log_error "Automatic deployment failed at line $LINENO"' ERR

# Parse command line arguments
AUTO_CONFIRM=false
FORCE_STRATEGY=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-confirm)
            AUTO_CONFIRM=true
            shift
            ;;
        --force-strategy)
            FORCE_STRATEGY="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Override strategy if forced
if [ -n "$FORCE_STRATEGY" ]; then
    DEPLOYMENT_STRATEGY="$FORCE_STRATEGY"
    log_warning "Deployment strategy forced to: $DEPLOYMENT_STRATEGY"
fi

# Handle dry run
if [ "$DRY_RUN" = true ]; then
    check_prerequisites
    analyze_resources
    display_strategy_details
    log_info "Dry run completed. No deployment executed."
    exit 0
fi

# Run main function
main "$@" 