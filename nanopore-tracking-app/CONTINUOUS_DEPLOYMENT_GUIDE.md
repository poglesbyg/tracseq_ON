# Continuous Deployment Guide for Nanopore Tracking App

## 🚀 Quick Start

### Option 1: Manual Deployment (Immediate)
```bash
# Deploy to production with tests
pnpm run deploy

# Quick deployment without tests
pnpm run deploy:quick

# Deploy to staging environment
pnpm run deploy:staging

# Rollback if needed
pnpm run rollback
```

### Option 2: Automated GitHub Actions (Recommended)
1. **Setup GitHub Secrets** (one-time setup):
   - `OPENSHIFT_SERVER_URL`: Your OpenShift cluster URL
   - `OPENSHIFT_TOKEN`: Service account token
   - `GITHUB_TOKEN`: GitHub token for releases

2. **Automatic Deployment**:
   - Push to `main` branch → Production deployment
   - Push to `develop` branch → Staging deployment
   - Pull requests → Run tests only

### Option 3: OpenShift Webhooks (Advanced)
```bash
# Run the setup script
./scripts/setup-continuous-deployment.sh

# Configure GitHub webhook with provided URL
# Push changes to trigger automatic builds
```

## 📋 Deployment Methods Comparison

| Method | Trigger | Testing | Rollback | Use Case |
|--------|---------|---------|----------|----------|
| Manual Script | On-demand | Optional | Manual | Development, testing |
| GitHub Actions | Git push | Automatic | Automatic | Production, CI/CD |
| OpenShift Webhooks | Git push | Pipeline | Manual | Advanced automation |

## 🔧 Setup Instructions

### 1. GitHub Actions Setup (Recommended)

#### Step 1: Configure Repository Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions:

```
OPENSHIFT_SERVER_URL = https://your-openshift-cluster.com
OPENSHIFT_TOKEN = sha256~your-service-account-token
GITHUB_TOKEN = ghp_your-github-token
```

#### Step 2: Create Service Account Token
```bash
# Login to OpenShift
oc login

# Create service account
oc create serviceaccount github-actions

# Grant permissions
oc policy add-role-to-user edit system:serviceaccount:$(oc project -q):github-actions

# Get token
oc serviceaccounts get-token github-actions
```

#### Step 3: Test Deployment
```bash
# Push to main branch
git push origin main

# Check GitHub Actions tab for deployment status
```

### 2. Manual Deployment Setup

#### Prerequisites
- OpenShift CLI (`oc`) installed
- Logged into OpenShift cluster
- Node.js and pnpm installed (`npm install -g pnpm`)

#### Usage
```bash
# Full deployment with all checks
./scripts/deploy-openshift.sh

# Deploy to staging
./scripts/deploy-openshift.sh --env staging

# Skip tests for quick deployment
./scripts/deploy-openshift.sh --skip-tests

# Get help
./scripts/deploy-openshift.sh --help
```

### 3. OpenShift Webhooks Setup

#### Step 1: Run Setup Script
```bash
./scripts/setup-continuous-deployment.sh
```

#### Step 2: Configure GitHub Webhook
1. Go to GitHub repository → Settings → Webhooks
2. Add webhook with URL provided by setup script
3. Set Content type to `application/json`
4. Use the webhook secret from setup output
5. Select "Push events" trigger

#### Step 3: Test Webhook
```bash
# Make a change and push
git commit -m "Test webhook deployment"
git push origin main

# Check OpenShift builds
oc get builds -w
```

## 🔍 Monitoring and Troubleshooting

### Health Checks
```bash
# Check application health
curl https://your-app-url/health

# Check database connectivity
curl https://your-app-url/health/database

# Check AI service
curl https://your-app-url/health/ai
```

### Deployment Status
```bash
# Check deployment status
oc rollout status deployment/nanopore-tracking-app

# View pods
oc get pods -l app=nanopore-tracking-app

# Check recent builds
oc get builds -l app=nanopore-tracking-app

# View logs
oc logs -l app=nanopore-tracking-app -f
```

### Common Issues and Solutions

#### 1. Build Failures
```bash
# Check build logs
oc logs build/nanopore-tracking-app-1

# Common causes:
# - Missing dependencies in package.json
# - Build script errors
# - Insufficient resources
```

#### 2. Deployment Failures
```bash
# Check pod events
oc describe pod [pod-name]

# Common causes:
# - Image pull errors
# - Resource limits
# - Configuration issues
```

#### 3. Health Check Failures
```bash
# Check application logs
oc logs deployment/nanopore-tracking-app

# Common causes:
# - Database connectivity
# - Missing environment variables
# - Port binding issues
```

## 🔄 Rollback Procedures

### Automatic Rollback
- GitHub Actions automatically rolls back on failure
- Manual deployment script includes rollback on failure

### Manual Rollback
```bash
# Rollback to previous version
pnpm run rollback

# Or using OpenShift CLI
oc rollout undo deployment/nanopore-tracking-app

# Rollback to specific revision
oc rollout undo deployment/nanopore-tracking-app --to-revision=2
```

### Rollback Verification
```bash
# Check rollout status
oc rollout status deployment/nanopore-tracking-app

# Verify application health
curl https://your-app-url/health

# Check deployment history
oc rollout history deployment/nanopore-tracking-app
```

## 🔐 Security Best Practices

### Secrets Management
- Use OpenShift secrets for sensitive data
- Rotate webhook secrets regularly
- Use service accounts with minimal permissions

### Network Security
- All communications use HTTPS/TLS
- Webhook endpoints are secured
- Internal services use cluster networking

### Access Control
- GitHub Actions uses service account tokens
- Webhook secrets are stored securely
- Role-based access control (RBAC) enforced

## 📊 Performance Optimization

### Resource Limits
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Scaling Configuration
```bash
# Manual scaling
oc scale deployment/nanopore-tracking-app --replicas=3

# Auto-scaling (if HPA is configured)
oc autoscale deployment/nanopore-tracking-app --min=1 --max=5 --cpu-percent=80
```

### Build Optimization
- Use multi-stage Docker builds
- Optimize image layers
- Use build caching where possible

## 🔧 Maintenance Tasks

### Regular Maintenance
- Update base images monthly
- Review and rotate secrets quarterly
- Monitor resource usage and adjust limits
- Update dependencies regularly

### Backup Verification
- Test database backups monthly
- Verify disaster recovery procedures
- Document recovery time objectives (RTO)

### Security Updates
- Monitor for security vulnerabilities
- Update dependencies with security patches
- Review access logs regularly

## 📞 Support and Contact

### Getting Help
1. Check the troubleshooting section above
2. Review OpenShift and GitHub Actions logs
3. Consult the deployment documentation
4. Contact the development team

### Useful Commands Reference
```bash
# Deployment commands
pnpm run deploy                   # Full deployment
pnpm run deploy:quick             # Quick deployment
pnpm run deploy:staging           # Staging deployment
pnpm run rollback                 # Rollback

# OpenShift commands
oc get pods                      # List pods
oc logs -f deployment/app        # Follow logs
oc describe pod [name]           # Pod details
oc rollout status deployment/app # Deployment status

# GitHub Actions
# Check Actions tab in repository
# View workflow runs and logs
```

## 🎯 Next Steps

1. **Set up your preferred deployment method**
2. **Test the deployment process**
3. **Configure monitoring and alerting**
4. **Document your specific configuration**
5. **Train team members on procedures**

---

*This guide covers the complete continuous deployment setup for the Nanopore Tracking App. Choose the deployment method that best fits your workflow and requirements.* 