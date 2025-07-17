#!/bin/bash

# Memory-Optimized Prometheus Deployment Script
# Designed to work within strict memory quota constraints

set -e

NAMESPACE="dept-barc"
PROMETHEUS_NAME="prometheus-minimal"
MEMORY_LIMIT="128Mi"
MEMORY_REQUEST="64Mi"

echo "🚀 Starting memory-optimized Prometheus deployment..."

# Function to check memory quota
check_memory_quota() {
    echo "📊 Checking memory quota usage..."
    
    # Get compute-resources quota
    QUOTA_OUTPUT=$(oc get resourcequota compute-resources -n $NAMESPACE -o json 2>/dev/null || echo '{}')
    
    if [ "$QUOTA_OUTPUT" = '{}' ]; then
        echo "⚠️  Warning: compute-resources quota not found, proceeding with caution"
        return 0
    fi
    
    # Extract memory usage
    MEMORY_USED=$(echo $QUOTA_OUTPUT | jq -r '.status.used["limits.memory"] // "0Mi"')
    MEMORY_HARD=$(echo $QUOTA_OUTPUT | jq -r '.status.hard["limits.memory"] // "4Gi"')
    
    echo "Current memory quota usage:"
    echo "  Used: $MEMORY_USED"
    echo "  Limit: $MEMORY_HARD"
    
    # Convert to Mi for calculation
    MEMORY_USED_MI=$(echo $MEMORY_USED | sed 's/Mi//' | sed 's/Gi/*1024/' | bc 2>/dev/null || echo "0")
    MEMORY_HARD_MI=$(echo $MEMORY_HARD | sed 's/Mi//' | sed 's/Gi/*1024/' | bc 2>/dev/null || echo "4096")
    MEMORY_REQUEST_MI=$(echo $MEMORY_REQUEST | sed 's/Mi//')
    
    MEMORY_AVAILABLE=$((MEMORY_HARD_MI - MEMORY_USED_MI))
    
    echo "  Available: ${MEMORY_AVAILABLE}Mi"
    echo "  Prometheus needs: ${MEMORY_REQUEST_MI}Mi"
    
    if [ $MEMORY_AVAILABLE -lt $MEMORY_REQUEST_MI ]; then
        echo "❌ ERROR: Insufficient memory quota available"
        echo "   Available: ${MEMORY_AVAILABLE}Mi"
        echo "   Required: ${MEMORY_REQUEST_MI}Mi"
        echo ""
        echo "💡 Suggestions:"
        echo "   1. Clean up unused pods to free memory"
        echo "   2. Reduce memory limits on existing applications"
        echo "   3. Request quota increase from cluster administrator"
        exit 1
    fi
    
    echo "✅ Memory quota check passed"
}

# Function to check if Prometheus is already running
check_existing_prometheus() {
    echo "🔍 Checking for existing Prometheus deployments..."
    
    EXISTING_PROMETHEUS=$(oc get deployment -n $NAMESPACE -l app=prometheus -o name 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_PROMETHEUS" ]; then
        echo "⚠️  Found existing Prometheus deployment(s):"
        oc get deployment -n $NAMESPACE -l app=prometheus -o wide
        echo ""
        echo "❓ Do you want to continue? This will deploy a minimal Prometheus alongside existing ones."
        echo "   Press Ctrl+C to cancel or Enter to continue..."
        read -r
    fi
}

# Function to clean up resources if needed
cleanup_resources() {
    echo "🧹 Cleaning up any failed deployment resources..."
    
    # Remove any failed deployments
    oc delete deployment $PROMETHEUS_NAME -n $NAMESPACE --ignore-not-found=true
    oc delete configmap prometheus-minimal-config -n $NAMESPACE --ignore-not-found=true
    oc delete service prometheus-minimal -n $NAMESPACE --ignore-not-found=true
    oc delete servicemonitor prometheus-minimal-monitor -n $NAMESPACE --ignore-not-found=true
    oc delete networkpolicy prometheus-minimal-policy -n $NAMESPACE --ignore-not-found=true
    oc delete prometheusrule prometheus-quota-alerts -n $NAMESPACE --ignore-not-found=true
    
    echo "✅ Cleanup completed"
}

# Function to deploy Prometheus
deploy_prometheus() {
    echo "🚀 Deploying memory-optimized Prometheus..."
    
    # Apply the deployment
    oc apply -f deployment/openshift/memory-optimized-prometheus.yaml
    
    # Wait for deployment to be ready
    echo "⏳ Waiting for Prometheus deployment to be ready..."
    oc rollout status deployment/$PROMETHEUS_NAME -n $NAMESPACE --timeout=300s
    
    # Verify deployment
    READY_REPLICAS=$(oc get deployment $PROMETHEUS_NAME -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    if [ "$READY_REPLICAS" != "1" ]; then
        echo "❌ ERROR: Prometheus deployment failed. Ready replicas: $READY_REPLICAS"
        exit 1
    fi
    
    echo "✅ Prometheus deployment successful"
}

# Function to test Prometheus
test_prometheus() {
    echo "🧪 Testing Prometheus functionality..."
    
    # Get pod name
    POD_NAME=$(oc get pods -n $NAMESPACE -l app=prometheus-minimal -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$POD_NAME" ]; then
        echo "❌ ERROR: No Prometheus pods found"
        exit 1
    fi
    
    # Test health endpoint
    echo "Testing health endpoint..."
    if oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:9090/-/healthy > /dev/null; then
        echo "✅ Health endpoint working"
    else
        echo "❌ Health endpoint failed"
        exit 1
    fi
    
    # Test ready endpoint
    echo "Testing ready endpoint..."
    if oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:9090/-/ready > /dev/null; then
        echo "✅ Ready endpoint working"
    else
        echo "⚠️  Ready endpoint not yet available (normal during startup)"
    fi
    
    # Test metrics endpoint
    echo "Testing metrics endpoint..."
    if oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:9090/metrics | head -5 > /dev/null; then
        echo "✅ Metrics endpoint working"
    else
        echo "❌ Metrics endpoint failed"
        exit 1
    fi
    
    echo "✅ Basic tests passed"
}

# Function to configure service mesh scraping
configure_service_mesh_scraping() {
    echo "🔧 Configuring service mesh metrics scraping..."
    
    # Check if nanopore-tracking-app is running
    NANOPORE_PODS=$(oc get pods -n $NAMESPACE -l app=nanopore-tracking-app -o name 2>/dev/null || echo "")
    
    if [ -z "$NANOPORE_PODS" ]; then
        echo "⚠️  Warning: nanopore-tracking-app not found. Service mesh metrics won't be available."
        return 0
    fi
    
    # Test if service mesh metrics endpoint is accessible
    NANOPORE_POD=$(oc get pods -n $NAMESPACE -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}')
    
    if oc exec $NANOPORE_POD -n $NAMESPACE -- curl -s http://localhost:3001/api/service-mesh/metrics > /dev/null 2>&1; then
        echo "✅ Service mesh metrics endpoint accessible"
    else
        echo "⚠️  Service mesh metrics endpoint not yet available"
        echo "   This is normal if the quota-optimized service mesh hasn't been deployed yet"
    fi
}

# Function to display deployment status
show_status() {
    echo "📋 Deployment Status:"
    echo "==================="
    
    # Show deployment status
    echo "Prometheus Deployment:"
    oc get deployment $PROMETHEUS_NAME -n $NAMESPACE -o wide
    
    # Show pod status
    echo ""
    echo "Prometheus Pod:"
    oc get pods -n $NAMESPACE -l app=prometheus-minimal -o wide
    
    # Show service status
    echo ""
    echo "Prometheus Service:"
    oc get svc prometheus-minimal -n $NAMESPACE
    
    # Show current memory usage
    echo ""
    echo "Current Memory Usage:"
    oc get resourcequota compute-resources -n $NAMESPACE -o yaml | grep -A 5 "limits.memory"
    
    # Show Prometheus configuration
    echo ""
    echo "Prometheus Configuration:"
    oc get configmap prometheus-minimal-config -n $NAMESPACE -o yaml | grep -A 10 "prometheus.yml:"
    
    # Show access information
    echo ""
    echo "🌐 Access Information:"
    echo "====================="
    echo "Prometheus UI: http://prometheus-minimal.dept-barc.svc.cluster.local:9090"
    echo "Metrics API: http://prometheus-minimal.dept-barc.svc.cluster.local:9090/metrics"
    echo ""
    echo "To access from outside the cluster:"
    echo "oc port-forward svc/prometheus-minimal 9090:9090 -n $NAMESPACE"
    echo "Then visit: http://localhost:9090"
}

# Function to show resource optimization tips
show_optimization_tips() {
    echo ""
    echo "💡 Resource Optimization Tips:"
    echo "=============================="
    echo "1. Monitor memory usage: oc top pods -n $NAMESPACE"
    echo "2. Check Prometheus metrics: curl http://localhost:9090/metrics | grep prometheus_tsdb"
    echo "3. Adjust retention if needed: Edit prometheus.yml and update --storage.tsdb.retention.time"
    echo "4. Monitor quota usage: oc get resourcequota compute-resources -n $NAMESPACE"
    echo "5. Scale down if not needed: oc scale deployment $PROMETHEUS_NAME --replicas=0 -n $NAMESPACE"
    echo ""
    echo "📊 Monitoring Queries:"
    echo "====================="
    echo "Memory usage: prometheus_tsdb_symbol_table_size_bytes / (128 * 1024 * 1024)"
    echo "Storage usage: prometheus_tsdb_blocks_loaded"
    echo "Scrape targets: prometheus_sd_discovered_targets"
    echo "Service mesh metrics: service_mesh_requests_total"
}

# Main deployment flow
main() {
    echo "🎯 Memory-Optimized Prometheus Deployment"
    echo "=========================================="
    
    # Check prerequisites
    if ! command -v oc &> /dev/null; then
        echo "❌ ERROR: OpenShift CLI (oc) not found"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "❌ ERROR: jq not found"
        exit 1
    fi
    
    if ! command -v bc &> /dev/null; then
        echo "❌ ERROR: bc not found"
        exit 1
    fi
    
    # Check if we're logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        echo "❌ ERROR: Not logged in to OpenShift"
        exit 1
    fi
    
    # Check if namespace exists
    if ! oc get namespace $NAMESPACE &> /dev/null; then
        echo "❌ ERROR: Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Execute deployment steps
    check_memory_quota
    check_existing_prometheus
    cleanup_resources
    deploy_prometheus
    test_prometheus
    configure_service_mesh_scraping
    show_status
    show_optimization_tips
    
    echo ""
    echo "🎉 Memory-optimized Prometheus deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Access Prometheus UI: oc port-forward svc/prometheus-minimal 9090:9090 -n $NAMESPACE"
    echo "2. Deploy quota-optimized service mesh: ./deployment/scripts/deploy-quota-optimized.sh"
    echo "3. Monitor resource usage: oc top pods -n $NAMESPACE"
    echo "4. Check Prometheus targets: http://localhost:9090/targets"
}

# Handle script interruption
trap cleanup_resources ERR

# Run main function
main "$@" 