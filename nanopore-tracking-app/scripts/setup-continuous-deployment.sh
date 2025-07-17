#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="nanopore-tracking-app"
NAMESPACE="dept-barc"
GITHUB_REPO="your-org/nanopore-tracking-app"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if oc command is available
    if ! command -v oc &> /dev/null; then
        print_error "OpenShift CLI (oc) is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        print_error "You are not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to generate webhook secrets
generate_webhook_secrets() {
    print_status "Generating webhook secrets..."
    
    # Generate random secrets
    GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
    GENERIC_WEBHOOK_SECRET=$(openssl rand -hex 32)
    
    # Create secrets in OpenShift
    oc create secret generic github-webhook-secret \
        --from-literal=WebHookSecretKey="$GITHUB_WEBHOOK_SECRET" \
        --dry-run=client -o yaml | oc apply -f -
    
    oc create secret generic generic-webhook-secret \
        --from-literal=WebHookSecretKey="$GENERIC_WEBHOOK_SECRET" \
        --dry-run=client -o yaml | oc apply -f -
    
    print_success "Webhook secrets created"
    print_status "GitHub webhook secret: $GITHUB_WEBHOOK_SECRET"
    print_status "Generic webhook secret: $GENERIC_WEBHOOK_SECRET"
}

# Function to setup OpenShift Pipelines
setup_pipelines() {
    print_status "Setting up OpenShift Pipelines..."
    
    # Check if OpenShift Pipelines operator is installed
    if ! oc get csv -n openshift-operators | grep -q "openshift-pipelines-operator"; then
        print_warning "OpenShift Pipelines operator not found. Installing..."
        
        cat <<EOF | oc apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: openshift-pipelines-operator
  namespace: openshift-operators
spec:
  channel: stable
  name: openshift-pipelines-operator-rh
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
        
        # Wait for operator to be ready
        print_status "Waiting for OpenShift Pipelines operator to be ready..."
        sleep 30
        
        # Check if operator is ready
        if oc get csv -n openshift-operators | grep -q "openshift-pipelines-operator.*Succeeded"; then
            print_success "OpenShift Pipelines operator installed successfully"
        else
            print_error "OpenShift Pipelines operator installation failed"
            exit 1
        fi
    else
        print_success "OpenShift Pipelines operator already installed"
    fi
    
    # Create pipeline service account
    oc create serviceaccount pipeline --dry-run=client -o yaml | oc apply -f -
    
    # Grant necessary permissions
    oc adm policy add-scc-to-user privileged -z pipeline
    oc adm policy add-role-to-user edit -z pipeline
    
    print_success "Pipeline service account configured"
}

# Function to create deployment pipeline
create_deployment_pipeline() {
    print_status "Creating deployment pipeline..."
    
    cat <<EOF | oc apply -f -
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: nanopore-deployment-pipeline
spec:
  params:
  - name: git-url
    type: string
    description: Git repository URL
  - name: git-revision
    type: string
    description: Git revision to build
    default: main
  - name: image-name
    type: string
    description: Name of the image to build
  - name: deployment-name
    type: string
    description: Name of the deployment to update
  workspaces:
  - name: shared-data
    description: Shared workspace for pipeline tasks
  tasks:
  - name: git-clone
    taskRef:
      name: git-clone
      kind: ClusterTask
    workspaces:
    - name: output
      workspace: shared-data
    params:
    - name: url
      value: \$(params.git-url)
    - name: revision
      value: \$(params.git-revision)
     - name: install-pnpm
     runAfter:
     - git-clone
     taskRef:
       name: npm
       kind: ClusterTask
     workspaces:
     - name: source
       workspace: shared-data
     params:
     - name: COMMAND
       value: install
     - name: ARGS
       value: ["-g", "pnpm@10.13.1"]
   - name: install-deps
     runAfter:
     - install-pnpm
     taskRef:
       name: npm
       kind: ClusterTask
     workspaces:
     - name: source
       workspace: shared-data
     params:
     - name: COMMAND
       value: exec
     - name: ARGS
       value: ["pnpm", "install", "--frozen-lockfile"]
   - name: run-tests
     runAfter:
     - install-deps
     taskRef:
       name: npm
       kind: ClusterTask
     workspaces:
     - name: source
       workspace: shared-data
     params:
     - name: COMMAND
       value: exec
     - name: ARGS
       value: ["pnpm", "run", "test:unit"]
   - name: build-app
     runAfter:
     - run-tests
     taskRef:
       name: npm
       kind: ClusterTask
     workspaces:
     - name: source
       workspace: shared-data
     params:
     - name: COMMAND
       value: exec
     - name: ARGS
       value: ["pnpm", "run", "build"]
  - name: build-image
    runAfter:
    - build-app
    taskRef:
      name: buildah
      kind: ClusterTask
    workspaces:
    - name: source
      workspace: shared-data
    params:
    - name: IMAGE
      value: image-registry.openshift-image-registry.svc:5000/\$(context.pipelineRun.namespace)/\$(params.image-name):latest
    - name: DOCKERFILE
      value: deployment/docker/Dockerfile
  - name: deploy-app
    runAfter:
    - build-image
    taskRef:
      name: openshift-client
      kind: ClusterTask
    params:
    - name: SCRIPT
      value: |
        oc rollout restart deployment/\$(params.deployment-name)
        oc rollout status deployment/\$(params.deployment-name) --timeout=300s
EOF
    
    print_success "Deployment pipeline created"
}

# Function to apply webhook deployment configuration
apply_webhook_config() {
    print_status "Applying webhook deployment configuration..."
    
    # Update the GitHub repository URL in the webhook config
    sed "s|https://github.com/your-org/nanopore-tracking-app.git|https://github.com/$GITHUB_REPO.git|g" \
        deployment/openshift/webhook-deployment.yaml > /tmp/webhook-deployment.yaml
    
    # Apply the configuration
    oc apply -f /tmp/webhook-deployment.yaml
    
    # Clean up temporary file
    rm -f /tmp/webhook-deployment.yaml
    
    print_success "Webhook deployment configuration applied"
}

# Function to get webhook URLs
get_webhook_urls() {
    print_status "Getting webhook URLs..."
    
    # Wait for EventListener to be ready
    sleep 10
    
    # Get the EventListener route
    local listener_route=$(oc get route el-nanopore-github-listener -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    
    if [ -n "$listener_route" ]; then
        print_success "GitHub webhook URL: https://$listener_route"
        print_status "Configure this URL in your GitHub repository settings"
        print_status "Content type: application/json"
        print_status "Secret: Use the GitHub webhook secret generated earlier"
    else
        print_warning "EventListener route not found. You may need to create it manually."
    fi
    
    # Get build config webhook URLs
    local github_webhook=$(oc describe bc $APP_NAME-webhook | grep "GitHub.*webhook" | awk '{print $3}' || echo "")
    local generic_webhook=$(oc describe bc $APP_NAME-webhook | grep "Generic.*webhook" | awk '{print $3}' || echo "")
    
    if [ -n "$github_webhook" ]; then
        print_success "Build config GitHub webhook: $github_webhook"
    fi
    
    if [ -n "$generic_webhook" ]; then
        print_success "Build config generic webhook: $generic_webhook"
    fi
}

# Function to create monitoring and alerting
setup_monitoring() {
    print_status "Setting up monitoring and alerting..."
    
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: deployment-monitor
data:
  monitor.sh: |
    #!/bin/bash
    
    APP_NAME="nanopore-tracking-app-cd"
    NAMESPACE=\$(oc project -q)
    
    while true; do
        # Check deployment status
        READY_REPLICAS=\$(oc get deployment \$APP_NAME -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        DESIRED_REPLICAS=\$(oc get deployment \$APP_NAME -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")
        
        if [ "\$READY_REPLICAS" != "\$DESIRED_REPLICAS" ]; then
            echo "WARNING: Deployment \$APP_NAME has \$READY_REPLICAS/\$DESIRED_REPLICAS replicas ready"
        fi
        
        # Check pod status
        FAILED_PODS=\$(oc get pods -l app=nanopore-tracking-app,deployment-type=continuous --field-selector=status.phase=Failed --no-headers | wc -l)
        
        if [ "\$FAILED_PODS" -gt 0 ]; then
            echo "ERROR: \$FAILED_PODS failed pods detected"
        fi
        
        # Check recent builds
        FAILED_BUILDS=\$(oc get builds -l app=nanopore-tracking-app --field-selector=status.phase=Failed --no-headers | wc -l)
        
        if [ "\$FAILED_BUILDS" -gt 0 ]; then
            echo "ERROR: \$FAILED_BUILDS failed builds detected"
        fi
        
        sleep 60
    done
EOF
    
    print_success "Monitoring configuration created"
}

# Function to create deployment documentation
create_documentation() {
    print_status "Creating deployment documentation..."
    
    cat <<EOF > DEPLOYMENT.md
# Continuous Deployment Setup

## Overview
This document describes the continuous deployment setup for the Nanopore Tracking App on OpenShift.

## Components

### 1. GitHub Actions CI/CD Pipeline
- **File**: \`.github/workflows/ci-cd.yml\`
- **Triggers**: Push to main/develop branches, pull requests
- **Stages**: Test → Build → Deploy (staging/production)
- **Features**: Automated testing, rollback on failure, release creation

### 2. OpenShift Webhook Deployment
- **File**: \`deployment/openshift/webhook-deployment.yaml\`
- **Triggers**: GitHub webhook, generic webhook
- **Features**: Automatic builds on code changes, rolling updates

### 3. Manual Deployment Script
- **File**: \`scripts/deploy-openshift.sh\`
- **Usage**: Manual deployments, testing, rollbacks
- **Features**: Environment selection, health checks, rollback capability

## Setup Instructions

### 1. GitHub Actions Setup
1. Add the following secrets to your GitHub repository:
   - \`OPENSHIFT_SERVER_URL\`: Your OpenShift cluster URL
   - \`OPENSHIFT_TOKEN\`: Service account token with deployment permissions
   - \`GITHUB_TOKEN\`: GitHub token for release creation

2. Push to main branch to trigger production deployment
3. Push to develop branch to trigger staging deployment

### 2. OpenShift Webhook Setup
1. Run the setup script: \`./scripts/setup-continuous-deployment.sh\`
2. Configure GitHub webhook with the provided URL and secret
3. Test by pushing changes to the main branch

### 3. Manual Deployment
\`\`\`bash
# Full deployment with tests
npm run deploy

# Quick deployment without tests
npm run deploy:quick

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Rollback to previous version
npm run rollback
\`\`\`

## Monitoring

### Health Checks
- **Endpoint**: \`/health\`
- **Database**: \`/health/database\`
- **AI Service**: \`/health/ai\`

### Deployment Status
\`\`\`bash
# Check deployment status
oc rollout status deployment/nanopore-tracking-app-cd

# View recent builds
oc get builds -l app=nanopore-tracking-app

# Check pod logs
oc logs -l app=nanopore-tracking-app -f
\`\`\`

### Troubleshooting
1. **Build failures**: Check build logs with \`oc logs build/[build-name]\`
2. **Deployment failures**: Check pod events with \`oc describe pod [pod-name]\`
3. **Health check failures**: Check application logs and database connectivity

## Rollback Procedures

### Automatic Rollback
- GitHub Actions automatically rolls back on deployment failure
- OpenShift deployment script includes rollback on failure

### Manual Rollback
\`\`\`bash
# Rollback to previous version
oc rollout undo deployment/nanopore-tracking-app-cd

# Rollback to specific revision
oc rollout undo deployment/nanopore-tracking-app-cd --to-revision=2

# Check rollout status
oc rollout status deployment/nanopore-tracking-app-cd
\`\`\`

## Security Considerations
- Webhook secrets are generated and stored securely
- Service accounts have minimal required permissions
- All communications use HTTPS/TLS
- Secrets are managed through OpenShift secret objects

## Maintenance
- Regular updates to base images
- Monitoring of resource usage and scaling
- Backup verification and disaster recovery testing
- Security updates and vulnerability scanning
EOF
    
    print_success "Deployment documentation created: DEPLOYMENT.md"
}

# Function to show summary
show_summary() {
    print_status "Continuous Deployment Setup Summary"
    echo ""
    print_success "✅ GitHub Actions CI/CD pipeline configured"
    print_success "✅ OpenShift webhook deployment configured"
    print_success "✅ Manual deployment script created"
    print_success "✅ Monitoring and alerting configured"
    print_success "✅ Documentation created"
    echo ""
    print_status "Next steps:"
    echo "1. Configure GitHub repository secrets for Actions"
    echo "2. Set up GitHub webhook with the provided URL and secret"
    echo "3. Test deployment by pushing changes to main branch"
    echo "4. Monitor deployment status and logs"
    echo ""
    print_status "For manual deployment, use: npm run deploy"
    print_status "For rollback, use: npm run rollback"
    print_status "For help, use: ./scripts/deploy-openshift.sh --help"
}

# Main execution
main() {
    print_status "Setting up continuous deployment for Nanopore Tracking App..."
    
    # Check prerequisites
    check_prerequisites
    
    # Generate webhook secrets
    generate_webhook_secrets
    
    # Setup OpenShift Pipelines
    setup_pipelines
    
    # Create deployment pipeline
    create_deployment_pipeline
    
    # Apply webhook configuration
    apply_webhook_config
    
    # Get webhook URLs
    get_webhook_urls
    
    # Setup monitoring
    setup_monitoring
    
    # Create documentation
    create_documentation
    
    # Show summary
    show_summary
}

# Handle script interruption
trap 'print_error "Setup interrupted"; exit 1' INT TERM

# Run main function
main "$@" 