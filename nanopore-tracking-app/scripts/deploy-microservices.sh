#!/bin/bash

# Nanopore Tracking App - Microservices Deployment Script
# This script deploys the microservices architecture to OpenShift/Kubernetes

set -e

# Configuration
NAMESPACE="nanopore-tracking"
PROJECT_NAME="nanopore-tracking-app"
IMAGE_TAG=${IMAGE_TAG:-"latest"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
REGISTRY_URL=${REGISTRY_URL:-""}
STORAGE_CLASS_FAST=${STORAGE_CLASS_FAST:-"fast-ssd"}
STORAGE_CLASS_STANDARD=${STORAGE_CLASS_STANDARD:-"standard"}

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl/oc is installed
    if command -v oc &> /dev/null; then
        CLI_TOOL="oc"
        log_success "OpenShift CLI (oc) found"
    elif command -v kubectl &> /dev/null; then
        CLI_TOOL="kubectl"
        log_success "Kubernetes CLI (kubectl) found"
    else
        log_error "Neither oc nor kubectl found. Please install one of them."
        exit 1
    fi
    
    # Check if we're logged in
    if ! $CLI_TOOL whoami &> /dev/null; then
        log_error "Not logged in to cluster. Please login first."
        exit 1
    fi
    
    # Check if Docker is available for building
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Image building will be skipped."
    fi
    
    log_success "Prerequisites check completed"
}

# Build Docker image
build_image() {
    if [ -z "$REGISTRY_URL" ]; then
        log_warning "No registry URL provided. Skipping image build."
        return
    fi
    
    log_info "Building Docker image..."
    
    # Build the image
    docker build -t $REGISTRY_URL/$PROJECT_NAME:$IMAGE_TAG .
    
    # Push to registry
    log_info "Pushing image to registry..."
    docker push $REGISTRY_URL/$PROJECT_NAME:$IMAGE_TAG
    
    log_success "Image built and pushed: $REGISTRY_URL/$PROJECT_NAME:$IMAGE_TAG"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace: $NAMESPACE"
    
    if $CLI_TOOL get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace $NAMESPACE already exists"
    else
        $CLI_TOOL create namespace $NAMESPACE
        log_success "Namespace $NAMESPACE created"
    fi
    
    # Set current context to the namespace
    $CLI_TOOL config set-context --current --namespace=$NAMESPACE
}

# Deploy databases
deploy_databases() {
    log_info "Deploying database services..."
    
    # Create database secrets (these should be properly configured in production)
    cat <<EOF | $CLI_TOOL apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: database-secrets
  namespace: $NAMESPACE
type: Opaque
data:
  # These are base64 encoded placeholder values - replace with actual values
  POSTGRES_USER: cG9zdGdyZXM=
  POSTGRES_PASSWORD: cGFzc3dvcmQ=
  POSTGRES_DB: bmFub3BvcmVfZGI=
EOF
    
    # Deploy PostgreSQL for each service
    for service in samples ai audit backup config; do
        log_info "Deploying $service database..."
        
        cat <<EOF | $CLI_TOOL apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service}-db
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${service}-db
  template:
    metadata:
      labels:
        app: ${service}-db
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: database-secrets
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secrets
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          value: ${service}_db
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 1Gi
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: ${service}-db-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ${service}-db
  namespace: $NAMESPACE
spec:
  selector:
    app: ${service}-db
  ports:
  - port: 5432
    targetPort: 5432
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${service}-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: $STORAGE_CLASS_STANDARD
EOF
    done
    
    log_success "Database services deployed"
}

# Deploy microservices
deploy_microservices() {
    log_info "Deploying microservices..."
    
    # Update image in deployment manifests
    if [ -n "$REGISTRY_URL" ]; then
        sed -i "s|image: nanopore-tracking-app:latest|image: $REGISTRY_URL/$PROJECT_NAME:$IMAGE_TAG|g" deployment/openshift/microservices-deployment.yaml
    fi
    
    # Update storage class names
    sed -i "s|storageClassName: fast-ssd|storageClassName: $STORAGE_CLASS_FAST|g" deployment/openshift/microservices-deployment.yaml
    sed -i "s|storageClassName: standard|storageClassName: $STORAGE_CLASS_STANDARD|g" deployment/openshift/microservices-deployment.yaml
    
    # Apply microservices deployment
    $CLI_TOOL apply -f deployment/openshift/microservices-deployment.yaml
    
    log_success "Microservices deployed"
}

# Deploy autoscaling
deploy_autoscaling() {
    log_info "Deploying autoscaling configurations..."
    
    $CLI_TOOL apply -f deployment/openshift/autoscaling.yaml
    
    log_success "Autoscaling configurations deployed"
}

# Deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Update storage class names in monitoring
    sed -i "s|storageClassName: fast-ssd|storageClassName: $STORAGE_CLASS_FAST|g" deployment/openshift/monitoring.yaml
    sed -i "s|storageClassName: standard|storageClassName: $STORAGE_CLASS_STANDARD|g" deployment/openshift/monitoring.yaml
    
    $CLI_TOOL apply -f deployment/openshift/monitoring.yaml
    
    log_success "Monitoring stack deployed"
}

# Wait for deployments
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    # List of deployments to wait for
    deployments=(
        "sample-service"
        "ai-service"
        "audit-service"
        "backup-service"
        "config-service"
        "prometheus"
        "grafana"
        "alertmanager"
    )
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment to be ready..."
        $CLI_TOOL rollout status deployment/$deployment --timeout=300s
        log_success "$deployment is ready"
    done
    
    # Wait for databases
    for service in samples ai audit backup config; do
        log_info "Waiting for ${service}-db to be ready..."
        $CLI_TOOL rollout status deployment/${service}-db --timeout=300s
        log_success "${service}-db is ready"
    done
}

# Create routes/ingress
create_routes() {
    log_info "Creating routes/ingress..."
    
    if [ "$CLI_TOOL" = "oc" ]; then
        # OpenShift routes
        cat <<EOF | $CLI_TOOL apply -f -
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: nanopore-app
  namespace: $NAMESPACE
spec:
  to:
    kind: Service
    name: sample-service
  port:
    targetPort: http
  tls:
    termination: edge
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: grafana
  namespace: $NAMESPACE
spec:
  to:
    kind: Service
    name: grafana
  port:
    targetPort: 3000
  tls:
    termination: edge
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: prometheus
  namespace: $NAMESPACE
spec:
  to:
    kind: Service
    name: prometheus
  port:
    targetPort: 9090
  tls:
    termination: edge
EOF
    else
        # Kubernetes ingress
        cat <<EOF | $CLI_TOOL apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nanopore-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: nanopore-app.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: sample-service
            port:
              number: 80
  - host: grafana.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 3000
  - host: prometheus.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus
            port:
              number: 9090
EOF
    fi
    
    log_success "Routes/Ingress created"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create migration job
    cat <<EOF | $CLI_TOOL apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: database-migration
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migration
        image: ${REGISTRY_URL:-""}$PROJECT_NAME:$IMAGE_TAG
        command: ["node", "scripts/migrate-to-service-databases.js"]
        env:
        - name: NODE_ENV
          value: "production"
        - name: SAMPLES_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: microservices-secrets
              key: SAMPLES_DATABASE_URL
        - name: AI_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: microservices-secrets
              key: AI_DATABASE_URL
        - name: AUDIT_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: microservices-secrets
              key: AUDIT_DATABASE_URL
        - name: BACKUP_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: microservices-secrets
              key: BACKUP_DATABASE_URL
        - name: CONFIG_DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: microservices-secrets
              key: CONFIG_DATABASE_URL
      restartPolicy: Never
  backoffLimit: 3
EOF
    
    # Wait for migration to complete
    log_info "Waiting for migration job to complete..."
    $CLI_TOOL wait --for=condition=complete job/database-migration --timeout=600s
    
    log_success "Database migrations completed"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    # Check if all pods are running
    if $CLI_TOOL get pods --field-selector=status.phase!=Running | grep -q "0/"; then
        log_warning "Some pods are not running. Check with: $CLI_TOOL get pods"
    else
        log_success "All pods are running"
    fi
    
    # Check services
    log_info "Checking services..."
    $CLI_TOOL get svc
    
    # Check routes/ingress
    if [ "$CLI_TOOL" = "oc" ]; then
        log_info "Checking routes..."
        $CLI_TOOL get routes
    else
        log_info "Checking ingress..."
        $CLI_TOOL get ingress
    fi
    
    log_success "Health check completed"
}

# Display deployment information
display_info() {
    log_info "Deployment completed successfully!"
    
    echo ""
    echo "=== Deployment Information ==="
    echo "Namespace: $NAMESPACE"
    echo "Environment: $ENVIRONMENT"
    echo "Image Tag: $IMAGE_TAG"
    echo ""
    
    echo "=== Services ==="
    $CLI_TOOL get svc
    echo ""
    
    echo "=== Deployments ==="
    $CLI_TOOL get deployments
    echo ""
    
    if [ "$CLI_TOOL" = "oc" ]; then
        echo "=== Routes ==="
        $CLI_TOOL get routes
        echo ""
        
        echo "=== Access URLs ==="
        echo "Application: https://$(oc get route nanopore-app -o jsonpath='{.spec.host}')"
        echo "Grafana: https://$(oc get route grafana -o jsonpath='{.spec.host}')"
        echo "Prometheus: https://$(oc get route prometheus -o jsonpath='{.spec.host}')"
    else
        echo "=== Ingress ==="
        $CLI_TOOL get ingress
        echo ""
        
        echo "=== Access URLs (add to /etc/hosts) ==="
        echo "Application: http://nanopore-app.local"
        echo "Grafana: http://grafana.local"
        echo "Prometheus: http://prometheus.local"
    fi
    
    echo ""
    echo "=== Monitoring ==="
    echo "Grafana default login: admin/admin123"
    echo "Prometheus metrics available at /metrics endpoints"
    echo ""
    
    echo "=== Next Steps ==="
    echo "1. Configure proper TLS certificates"
    echo "2. Set up proper database credentials"
    echo "3. Configure external monitoring alerts"
    echo "4. Set up backup schedules"
    echo "5. Configure log aggregation"
    echo ""
    
    log_success "Deployment information displayed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Restore original files if they were modified
    git checkout -- deployment/openshift/microservices-deployment.yaml deployment/openshift/monitoring.yaml 2>/dev/null || true
}

# Main deployment function
main() {
    log_info "Starting microservices deployment..."
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    
    if [ "$1" = "--build" ]; then
        build_image
    fi
    
    create_namespace
    deploy_databases
    deploy_microservices
    deploy_autoscaling
    deploy_monitoring
    
    wait_for_deployments
    create_routes
    
    if [ "$1" = "--migrate" ]; then
        run_migrations
    fi
    
    health_check
    display_info
    
    log_success "Microservices deployment completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Nanopore Tracking App - Microservices Deployment Script

Usage: $0 [OPTIONS]

Options:
  --build     Build and push Docker image before deployment
  --migrate   Run database migrations after deployment
  --help      Show this help message

Environment Variables:
  NAMESPACE              Kubernetes namespace (default: nanopore-tracking)
  IMAGE_TAG              Docker image tag (default: latest)
  ENVIRONMENT            Deployment environment (default: production)
  REGISTRY_URL           Docker registry URL (required for --build)
  STORAGE_CLASS_FAST     Fast storage class name (default: fast-ssd)
  STORAGE_CLASS_STANDARD Standard storage class name (default: standard)

Examples:
  $0                     # Deploy with existing images
  $0 --build             # Build images and deploy
  $0 --build --migrate   # Build, deploy, and run migrations
  
  # With custom registry
  REGISTRY_URL=registry.example.com/myorg $0 --build

EOF
}

# Parse command line arguments
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 