#!/bin/bash

# Quota-Optimized Service Mesh Deployment Script
# Based on resourcequota-default-quota.yaml constraints

set -e

NAMESPACE="dept-barc"
DEPLOYMENT_NAME="nanopore-tracking-app"

echo "🚀 Starting quota-optimized service mesh deployment..."

# Function to check resource quota
check_quota() {
    echo "📊 Checking current resource quota usage..."
    
    # Get current quota status
    QUOTA_OUTPUT=$(oc get resourcequota default-quota -n $NAMESPACE -o json)
    
    # Extract current usage
    PODS_USED=$(echo $QUOTA_OUTPUT | jq -r '.status.used.pods // "0"')
    PODS_LIMIT=$(echo $QUOTA_OUTPUT | jq -r '.status.hard.pods // "10"')
    SERVICES_USED=$(echo $QUOTA_OUTPUT | jq -r '.status.used.services // "0"')
    SERVICES_LIMIT=$(echo $QUOTA_OUTPUT | jq -r '.status.hard.services // "10"')
    MEMORY_USED=$(echo $QUOTA_OUTPUT | jq -r '.status.used["requests.memory"] // "0"')
    MEMORY_LIMIT=$(echo $QUOTA_OUTPUT | jq -r '.status.hard["requests.memory"] // "5Gi"')
    
    echo "Current quota usage:"
    echo "  Pods: $PODS_USED/$PODS_LIMIT"
    echo "  Services: $SERVICES_USED/$SERVICES_LIMIT"
    echo "  Memory: $MEMORY_USED/$MEMORY_LIMIT"
    
    # Check if we have available resources
    if [ "$PODS_USED" -ge "$PODS_LIMIT" ]; then
        echo "❌ ERROR: Pod quota exceeded. Cannot deploy."
        exit 1
    fi
    
    if [ "$SERVICES_USED" -ge "$SERVICES_LIMIT" ]; then
        echo "⚠️  WARNING: Service quota at limit. Using existing services only."
        export SERVICE_QUOTA_EXHAUSTED=true
    fi
    
    echo "✅ Quota check passed"
}

# Function to update existing deployment with service mesh
update_deployment() {
    echo "🔄 Updating existing deployment with service mesh capabilities..."
    
    # Apply the quota-optimized service mesh configuration
    oc apply -f deployment/openshift/quota-optimized-service-mesh.yaml
    
    # Wait for rollout to complete
    echo "⏳ Waiting for deployment rollout..."
    oc rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s
    
    # Verify deployment is running
    READY_REPLICAS=$(oc get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    if [ "$READY_REPLICAS" != "1" ]; then
        echo "❌ ERROR: Deployment failed. Ready replicas: $READY_REPLICAS"
        exit 1
    fi
    
    echo "✅ Deployment updated successfully"
}

# Function to configure service mesh monitoring
setup_monitoring() {
    echo "📊 Setting up service mesh monitoring..."
    
    # Apply ServiceMonitor for Prometheus scraping
    cat <<EOF | oc apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nanopore-service-mesh-monitor
  namespace: $NAMESPACE
  labels:
    app: nanopore-tracking-app
    service-mesh: enabled
spec:
  selector:
    matchLabels:
      app: nanopore-tracking-app
  endpoints:
  - port: http
    path: /api/service-mesh/metrics
    interval: 30s
    scrapeTimeout: 10s
EOF
    
    # Apply PrometheusRule for quota monitoring
    cat <<EOF | oc apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: quota-monitoring-alerts
  namespace: $NAMESPACE
spec:
  groups:
  - name: quota.alerts
    rules:
    - alert: PodQuotaHigh
      expr: kube_resourcequota{resource="pods", type="used"} / kube_resourcequota{resource="pods", type="hard"} > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod quota usage is high"
        description: "Pod quota usage is {{ \$value | humanizePercentage }}"
    - alert: ServiceQuotaExhausted
      expr: kube_resourcequota{resource="services", type="used"} / kube_resourcequota{resource="services", type="hard"} >= 1.0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Service quota exhausted"
        description: "Cannot create new services in namespace $NAMESPACE"
EOF
    
    echo "✅ Monitoring configured"
}

# Function to test service mesh functionality
test_service_mesh() {
    echo "🧪 Testing service mesh functionality..."
    
    # Get pod name
    POD_NAME=$(oc get pods -n $NAMESPACE -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$POD_NAME" ]; then
        echo "❌ ERROR: No pods found"
        exit 1
    fi
    
    # Test health endpoint
    echo "Testing health endpoint..."
    oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:3001/health > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Health endpoint working"
    else
        echo "❌ Health endpoint failed"
        exit 1
    fi
    
    # Test service mesh health endpoint
    echo "Testing service mesh health endpoint..."
    oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:3001/api/service-mesh/health > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Service mesh health endpoint working"
    else
        echo "⚠️  Service mesh health endpoint not yet available (expected during initial deployment)"
    fi
    
    # Test metrics endpoint
    echo "Testing metrics endpoint..."
    oc exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:3001/api/service-mesh/metrics > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Metrics endpoint working"
    else
        echo "⚠️  Metrics endpoint not yet available (expected during initial deployment)"
    fi
    
    echo "✅ Basic tests passed"
}

# Function to display deployment status
show_status() {
    echo "📋 Deployment Status:"
    echo "==================="
    
    # Show deployment status
    oc get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o wide
    
    # Show pod status
    echo ""
    echo "Pod Status:"
    oc get pods -n $NAMESPACE -l app=nanopore-tracking-app -o wide
    
    # Show service status
    echo ""
    echo "Service Status:"
    oc get svc -n $NAMESPACE -l app=nanopore-tracking-app
    
    # Show current quota usage
    echo ""
    echo "Current Quota Usage:"
    oc get resourcequota default-quota -n $NAMESPACE -o yaml | grep -A 10 "status:"
    
    # Show service mesh specific information
    echo ""
    echo "Service Mesh Configuration:"
    oc get configmap service-mesh-config -n $NAMESPACE -o yaml | grep -A 20 "service-mesh.yaml:"
}

# Function to cleanup if deployment fails
cleanup() {
    echo "🧹 Cleaning up failed deployment..."
    
    # Remove any partially created resources
    oc delete configmap service-mesh-config -n $NAMESPACE --ignore-not-found=true
    oc delete servicemonitor nanopore-service-mesh-monitor -n $NAMESPACE --ignore-not-found=true
    oc delete prometheusrule quota-monitoring-alerts -n $NAMESPACE --ignore-not-found=true
    
    echo "✅ Cleanup completed"
}

# Main deployment flow
main() {
    echo "🎯 Quota-Optimized Service Mesh Deployment"
    echo "=========================================="
    
    # Set up error handling
    trap cleanup ERR
    
    # Check prerequisites
    if ! command -v oc &> /dev/null; then
        echo "❌ ERROR: OpenShift CLI (oc) not found"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "❌ ERROR: jq not found"
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
    check_quota
    update_deployment
    setup_monitoring
    test_service_mesh
    show_status
    
    echo ""
    echo "🎉 Quota-optimized service mesh deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Monitor the application logs: oc logs -f deployment/$DEPLOYMENT_NAME -n $NAMESPACE"
    echo "2. Test the service mesh endpoints:"
    echo "   - Health: curl http://your-app-url/api/service-mesh/health"
    echo "   - Metrics: curl http://your-app-url/api/service-mesh/metrics"
    echo "3. Monitor resource usage: oc get resourcequota default-quota -n $NAMESPACE"
    echo "4. Check Prometheus alerts for quota monitoring"
}

# Run main function
main "$@" 