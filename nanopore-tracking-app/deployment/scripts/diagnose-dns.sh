#!/bin/bash

# DNS Diagnostic Script for OpenShift
# This script diagnoses DNS resolution issues and provides fixes

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
APP_LABEL="app=nanopore-tracking-app"

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

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

# Function to get a running pod
get_test_pod() {
    oc get pods -l "$APP_LABEL" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo ""
}

# Function to test DNS resolution
test_dns_resolution() {
    local pod_name="$1"
    local hostname="$2"
    local description="$3"
    
    log_test "Testing DNS resolution for $hostname ($description)"
    
    # Test with nslookup
    if oc exec "$pod_name" -- nslookup "$hostname" >/dev/null 2>&1; then
        log_success "✓ DNS resolution works for $hostname"
        return 0
    else
        log_error "✗ DNS resolution failed for $hostname"
        return 1
    fi
}

# Function to test service connectivity
test_service_connectivity() {
    local pod_name="$1"
    local service_name="$2"
    local port="$3"
    local description="$4"
    
    log_test "Testing connectivity to $service_name:$port ($description)"
    
    # Test with telnet/nc
    if oc exec "$pod_name" -- nc -zv "$service_name" "$port" >/dev/null 2>&1; then
        log_success "✓ Service connectivity works for $service_name:$port"
        return 0
    else
        log_error "✗ Service connectivity failed for $service_name:$port"
        return 1
    fi
}

# Function to check DNS configuration
check_dns_config() {
    local pod_name="$1"
    
    log_info "Checking DNS configuration in pod $pod_name"
    
    # Check /etc/resolv.conf
    log_test "Checking /etc/resolv.conf"
    oc exec "$pod_name" -- cat /etc/resolv.conf || log_error "Failed to read /etc/resolv.conf"
    
    echo ""
    
    # Check if DNS service is running
    log_test "Checking DNS service in kube-system namespace"
    oc get services -n kube-system | grep -i dns || log_warning "No DNS service found in kube-system"
    
    echo ""
    
    # Check if DNS pods are running
    log_test "Checking DNS pods in kube-system namespace"
    oc get pods -n kube-system | grep -i dns || log_warning "No DNS pods found in kube-system"
    
    echo ""
    
    # Check OpenShift DNS
    log_test "Checking OpenShift DNS service"
    oc get services -n openshift-dns | grep -i dns || log_warning "No DNS service found in openshift-dns"
    
    echo ""
    
    # Check DNS pods in OpenShift
    log_test "Checking DNS pods in openshift-dns namespace"
    oc get pods -n openshift-dns | grep -i dns || log_warning "No DNS pods found in openshift-dns"
}

# Function to test various DNS scenarios
run_dns_tests() {
    local pod_name="$1"
    
    log_info "Running comprehensive DNS tests from pod: $pod_name"
    echo ""
    
    # Test 1: Basic DNS resolution
    test_dns_resolution "$pod_name" "google.com" "External DNS"
    
    # Test 2: Kubernetes internal DNS
    test_dns_resolution "$pod_name" "kubernetes.default.svc.cluster.local" "Kubernetes API"
    
    # Test 3: Service in same namespace
    test_dns_resolution "$pod_name" "postgresql" "PostgreSQL service (short name)"
    test_dns_resolution "$pod_name" "postgresql.$NAMESPACE.svc.cluster.local" "PostgreSQL service (FQDN)"
    
    # Test 4: Application service
    test_dns_resolution "$pod_name" "nanopore-tracking-service" "Application service (short name)"
    test_dns_resolution "$pod_name" "nanopore-tracking-service.$NAMESPACE.svc.cluster.local" "Application service (FQDN)"
    
    echo ""
    
    # Test connectivity
    log_info "Testing service connectivity"
    
    # Get service IPs
    local postgres_ip
    postgres_ip=$(oc get service postgresql -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    local app_service_ip
    app_service_ip=$(oc get service nanopore-tracking-service -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    if [ -n "$postgres_ip" ]; then
        log_test "Testing direct IP connectivity to PostgreSQL ($postgres_ip:5432)"
        if oc exec "$pod_name" -- nc -zv "$postgres_ip" 5432 >/dev/null 2>&1; then
            log_success "✓ Direct IP connectivity to PostgreSQL works"
        else
            log_error "✗ Direct IP connectivity to PostgreSQL failed"
        fi
    fi
    
    if [ -n "$app_service_ip" ]; then
        log_test "Testing direct IP connectivity to app service ($app_service_ip:3001)"
        if oc exec "$pod_name" -- nc -zv "$app_service_ip" 3001 >/dev/null 2>&1; then
            log_success "✓ Direct IP connectivity to app service works"
        else
            log_error "✗ Direct IP connectivity to app service failed"
        fi
    fi
}

# Function to fix DNS issues
fix_dns_issues() {
    log_info "Attempting to fix DNS issues..."
    
    # 1. Restart DNS pods
    log_info "Restarting DNS pods in openshift-dns namespace..."
    oc delete pods -n openshift-dns -l dns.operator.openshift.io/daemonset-dns=default 2>/dev/null || log_warning "Failed to restart DNS pods"
    
    # 2. Check and fix DNS service
    log_info "Checking DNS service configuration..."
    
    # 3. Update deployment with DNS policy
    log_info "Updating deployment with explicit DNS policy..."
    oc patch deployment nanopore-tracking-app -p '{
        "spec": {
            "template": {
                "spec": {
                    "dnsPolicy": "ClusterFirst",
                    "dnsConfig": {
                        "options": [
                            {"name": "ndots", "value": "2"},
                            {"name": "edns0"},
                            {"name": "timeout", "value": "5"},
                            {"name": "attempts", "value": "3"}
                        ]
                    }
                }
            }
        }
    }' || log_warning "Failed to update DNS policy"
    
    # 4. Create a temporary DNS test pod
    log_info "Creating temporary DNS test pod..."
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: dns-test-pod
  namespace: $NAMESPACE
spec:
  containers:
  - name: dns-test
    image: busybox:1.35
    command: ["sleep", "3600"]
  restartPolicy: Never
EOF
    
    # Wait for pod to be ready
    oc wait --for=condition=Ready pod/dns-test-pod --timeout=60s || log_warning "DNS test pod not ready"
    
    # Test DNS from the test pod
    log_info "Testing DNS from temporary pod..."
    if oc exec dns-test-pod -- nslookup postgresql >/dev/null 2>&1; then
        log_success "DNS works from test pod"
    else
        log_error "DNS still not working from test pod"
    fi
    
    # Cleanup test pod
    oc delete pod dns-test-pod --ignore-not-found=true
}

# Function to create DNS workaround
create_dns_workaround() {
    log_info "Creating DNS workaround with service IPs..."
    
    # Get current service IPs
    local postgres_ip
    postgres_ip=$(oc get service postgresql -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    local app_service_ip
    app_service_ip=$(oc get service nanopore-tracking-service -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    if [ -n "$postgres_ip" ]; then
        log_info "PostgreSQL service IP: $postgres_ip"
        
        # Update DATABASE_URL with IP
        local new_db_url
        new_db_url="postgresql://nanopore_user:nanopore_password@$postgres_ip:5432/nanopore_tracking?sslmode=disable"
        local encoded_url
        encoded_url=$(echo -n "$new_db_url" | base64 -w 0)
        
        log_info "Updating DATABASE_URL with service IP..."
        oc patch secret nanopore-secrets -p "{\"data\":{\"database-url\":\"$encoded_url\"}}"
        
        log_success "DATABASE_URL updated with service IP"
    fi
    
    # Create a hosts file ConfigMap for service name resolution
    log_info "Creating hosts file ConfigMap for service resolution..."
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: service-hosts
  namespace: $NAMESPACE
data:
  hosts: |
    # Service name to IP mappings
    $postgres_ip postgresql
    $app_service_ip nanopore-tracking-service
EOF
    
    log_success "Service hosts ConfigMap created"
}

# Function to generate DNS report
generate_dns_report() {
    local pod_name
    pod_name=$(get_test_pod)
    
    if [ -z "$pod_name" ]; then
        log_error "No running pods found for testing"
        return 1
    fi
    
    echo ""
    echo "======================================="
    echo "  DNS DIAGNOSTIC REPORT"
    echo "  $(date)"
    echo "======================================="
    echo ""
    
    # Check DNS configuration
    check_dns_config "$pod_name"
    
    echo ""
    echo "======================================="
    echo "  DNS RESOLUTION TESTS"
    echo "======================================="
    echo ""
    
    # Run DNS tests
    run_dns_tests "$pod_name"
    
    echo ""
    echo "======================================="
    echo "  SERVICES AND ENDPOINTS"
    echo "======================================="
    echo ""
    
    # List services
    log_info "Services in namespace $NAMESPACE:"
    oc get services -o wide
    
    echo ""
    
    # List endpoints
    log_info "Endpoints in namespace $NAMESPACE:"
    oc get endpoints
    
    echo ""
    echo "======================================="
    echo "  RECOMMENDATIONS"
    echo "======================================="
    echo ""
    
    log_info "DNS Resolution Recommendations:"
    echo "1. If DNS is not working, use direct service IPs"
    echo "2. Check if DNS pods are running in openshift-dns namespace"
    echo "3. Verify DNS service configuration"
    echo "4. Consider using FQDN for service names"
    echo "5. Check network policies that might block DNS"
    echo ""
    
    echo "Quick fixes:"
    echo "  ./deployment/scripts/diagnose-dns.sh fix    # Attempt automatic fixes"
    echo "  ./deployment/scripts/diagnose-dns.sh workaround  # Create IP-based workaround"
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  report              Generate DNS diagnostic report (default)"
    echo "  test                Run DNS resolution tests"
    echo "  fix                 Attempt to fix DNS issues"
    echo "  workaround          Create IP-based workaround"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Generate DNS diagnostic report"
    echo "  $0 test             # Run DNS tests only"
    echo "  $0 fix              # Attempt to fix DNS issues"
    echo "  $0 workaround       # Create workaround using service IPs"
    echo ""
}

# Main function
main() {
    local command="${1:-report}"
    
    case "$command" in
        "report")
            generate_dns_report
            ;;
        "test")
            local pod_name
            pod_name=$(get_test_pod)
            if [ -n "$pod_name" ]; then
                run_dns_tests "$pod_name"
            else
                log_error "No running pods found for testing"
                exit 1
            fi
            ;;
        "fix")
            fix_dns_issues
            ;;
        "workaround")
            create_dns_workaround
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

# Run main function
main "$@" 