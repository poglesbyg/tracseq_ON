# Deployment Improvements for Nanopore Tracking App

## Overview

The production deployment at https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/nanopore was showing only the loading screen because of several issues that have now been addressed.

## Issues Fixed

### 1. Client-Side Hydration
- **Problem**: The React app wasn't loading due to `client:only` directive issues
- **Solution**: Changed to `client:load` for better production compatibility
- **File**: `src/pages/nanopore.astro`

### 2. Loading Detection
- **Problem**: Fixed 1.5-second timeout was too short for production
- **Solution**: Implemented smart detection that checks for React content with 5-second fallback
- **File**: `src/pages/nanopore.astro`

### 3. Environment Variables
- **Problem**: Missing critical environment variables in production
- **Solution**: Updated deployment configuration with all required variables
- **File**: `deployment/openshift/deployment.yaml`

### 4. Health Checks
- **Problem**: Health checks were pointing to `/nanopore` instead of dedicated endpoint
- **Solution**: Created `/health` endpoint for proper monitoring
- **File**: `src/pages/health.ts`

### 5. Error Handling
- **Problem**: No error boundary for React crashes
- **Solution**: Added comprehensive error boundary with user-friendly messages
- **File**: `src/components/nanopore/nanopore-app.tsx`

### 6. Security Configuration
- **Problem**: Missing JWT and session secrets
- **Solution**: Updated secret configuration with proper security keys
- **File**: `deployment/openshift/secret.yaml`

## Deployment Steps

### 1. Update Secrets (REQUIRED)

First, update the production secrets with actual values:

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 24)

# Encode them
echo -n "$JWT_SECRET" | base64
echo -n "$SESSION_SECRET" | base64
echo -n "$ENCRYPTION_KEY" | base64

# Update deployment/openshift/secret.yaml with these values
```

### 2. Deploy Updates

Use the new deployment script:

```bash
# Login to OpenShift
oc login [your-openshift-cluster]

# Run the update script
./scripts/update-deployment.sh
```

### 3. Verify Deployment

After deployment, verify everything is working:

```bash
# Check pod status
oc get pods -l app=nanopore-tracking-app

# Check logs
oc logs -l app=nanopore-tracking-app

# Test health endpoint
curl https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/health

# Visit the app
open https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/nanopore
```

## Production Configuration

### Required Environment Variables

```yaml
NODE_ENV: production
PORT: 3001
HOST: 0.0.0.0
DATABASE_URL: postgresql://[connection-string]
BASE_URL: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu
JWT_SECRET: [secure-random-string]
SESSION_SECRET: [secure-random-string]
ENCRYPTION_KEY: [32-character-string]
ENABLE_AI_FEATURES: false  # Set to true if Ollama is available
LOG_LEVEL: info
UPLOAD_DIR: /app/uploads
```

### Resource Requirements

- **Memory**: 256Mi (request) / 512Mi (limit)
- **CPU**: 200m (request) / 500m (limit)
- **Storage**: EmptyDir volume for uploads

## Monitoring

### Health Check Endpoint

The app now provides a health check at `/health`:

```json
{
  "status": "ok",
  "timestamp": "2024-01-14T22:30:00.000Z",
  "service": "nanopore-tracking-app",
  "version": "1.0.0",
  "uptime": 3600,
  "environment": "production"
}
```

### Debugging Production Issues

If the app still shows only the loading screen:

1. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for JavaScript errors
   - Check Network tab for failed requests

2. **Check Pod Logs**:
   ```bash
   oc logs -l app=nanopore-tracking-app --tail=100
   ```

3. **Check Environment Variables**:
   ```bash
   oc exec -it [pod-name] -- env | grep -E "NODE_ENV|DATABASE_URL|BASE_URL"
   ```

4. **Test API Endpoints**:
   ```bash
   # Health check
   curl https://[your-route]/health
   
   # API endpoint
   curl https://[your-route]/api/trpc/nanopore.list
   ```

## Performance Optimizations

### 1. Build Optimizations
- Using `client:load` instead of `client:only` for better hydration
- Proper code splitting with dynamic imports
- Optimized bundle size with tree shaking

### 2. Runtime Optimizations
- Error boundaries prevent full app crashes
- Progressive loading with proper loading states
- Efficient database connection pooling

### 3. Deployment Optimizations
- Health checks ensure pods are ready before traffic
- Resource limits prevent memory issues
- Volume mounts for file uploads

## Security Considerations

### 1. Secrets Management
- All secrets must be properly encoded in base64
- Use strong, random values for production
- Rotate secrets regularly

### 2. Database Security
- Use SSL/TLS connections (`sslmode=require`)
- Limit database user permissions
- Use connection pooling with timeouts

### 3. Application Security
- HTTPS only with edge termination
- Proper CORS configuration
- Rate limiting and request validation

## Next Steps

1. **Database Migration**: Ensure database schema is up to date
2. **Monitoring Setup**: Configure alerts for health check failures
3. **Backup Strategy**: Implement regular database backups
4. **CI/CD Pipeline**: Use GitHub Actions for automated deployments
5. **Performance Testing**: Load test the production environment

## Troubleshooting

### App Stuck on Loading
1. Check browser console for errors
2. Verify all environment variables are set
3. Check pod logs for startup errors
4. Ensure database is accessible

### Database Connection Errors
1. Verify DATABASE_URL is correct
2. Check network connectivity
3. Ensure database user has proper permissions
4. Check SSL certificate validity

### File Upload Issues
1. Verify UPLOAD_DIR exists and is writable
2. Check volume mount permissions
3. Ensure sufficient disk space
4. Verify file size limits

## Support

For additional help:
1. Check pod logs: `oc logs -l app=nanopore-tracking-app`
2. Describe deployment: `oc describe deployment nanopore-tracking-app`
3. Check events: `oc get events --sort-by='.lastTimestamp'` 