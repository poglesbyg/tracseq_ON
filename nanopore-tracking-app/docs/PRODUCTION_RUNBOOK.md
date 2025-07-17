# Nanopore Tracking Application - Production Runbook

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Deployment & Scaling](#deployment--scaling)
4. [Monitoring & Health Checks](#monitoring--health-checks)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Emergency Procedures](#emergency-procedures)
8. [Performance Optimization](#performance-optimization)
9. [Security Operations](#security-operations)
10. [Backup & Recovery](#backup--recovery)

## Overview

The Nanopore Tracking Application is a production-ready system for managing Oxford Nanopore sequencing samples. This runbook provides operational procedures for maintaining, monitoring, and troubleshooting the system in production.

### Key Components
- **Frontend**: React 19 + Astro 5.x (SSR)
- **Backend**: tRPC + Node.js
- **Database**: PostgreSQL with connection pooling
- **AI Services**: Ollama integration with resilient fallbacks
- **Deployment**: OpenShift with horizontal scaling
- **Storage**: Persistent volumes for uploads and application data

### Production Environment
- **Namespace**: dept-barc
- **URL**: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu
- **Current Scale**: 2 replicas (320Mi memory, 300m CPU each)
- **Database**: PostgreSQL with 5-20 connection pool

## System Architecture

### Application Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Application   │    │   Database      │
│   (OpenShift)   │───▶│   Pods (2x)     │───▶│   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   AI Services   │              │
         │              │   (Ollama)      │              │
         │              └─────────────────┘              │
         │                                                │
         ▼                                                ▼
┌─────────────────┐                            ┌─────────────────┐
│   Persistent    │                            │   Monitoring    │
│   Storage       │                            │   & Metrics     │
└─────────────────┘                            └─────────────────┘
```

### Data Flow
1. User requests → Load Balancer → Application Pods
2. Application → Database Connection Pool → PostgreSQL
3. PDF Processing → AI Services → Fallback Systems
4. File Storage → Persistent Volumes
5. Monitoring → Health Checks → Metrics Collection

## Deployment & Scaling

### Current Deployment Configuration

**Resource Limits (per pod):**
- Memory: 320Mi (request: 160Mi)
- CPU: 300m (request: 100m)
- Storage: 2Gi uploads + 1Gi app data

**Scaling Configuration:**
- Min replicas: 2
- Max replicas: 6
- CPU target: 70%
- Memory target: 80%

### Deployment Commands

```bash
# Deploy application
oc apply -f deployment/openshift/

# Scale deployment
oc scale deployment nanopore-tracking-app --replicas=3

# Update image
oc set image deployment/nanopore-tracking-app nanopore-tracking-app=image-registry.openshift-image-registry.svc:5000/dept-barc/nanopore-tracking-app:latest

# Check deployment status
oc get deployment nanopore-tracking-app
oc get pods -l app=nanopore-tracking-app
```

### Horizontal Pod Autoscaler

```bash
# Check HPA status
oc get hpa nanopore-tracking-app-hpa

# Describe HPA for details
oc describe hpa nanopore-tracking-app-hpa

# Manual scaling (bypass HPA)
oc patch hpa nanopore-tracking-app-hpa -p '{"spec":{"minReplicas":3}}'
```

## Monitoring & Health Checks

### Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Application health | `{"status": "healthy", "components": {...}}` |
| `/api/metrics` | System metrics | Prometheus format metrics |
| `/api/ai-service?action=health` | AI service health | AI service status |
| `/api/memory-optimize` | Memory statistics | Memory usage details |

### Key Metrics to Monitor

**Application Metrics:**
- Response time (target: <2s)
- Error rate (target: <5%)
- Memory usage (alert: >85%)
- CPU usage (alert: >80%)
- Database connections (alert: >15)

**Business Metrics:**
- Samples processed per hour
- PDF processing success rate
- AI service availability
- User activity levels

### Monitoring Commands

```bash
# Check pod health
oc get pods -l app=nanopore-tracking-app

# View pod logs
oc logs -f deployment/nanopore-tracking-app

# Check resource usage
oc top pods -l app=nanopore-tracking-app

# Monitor events
oc get events --sort-by=.metadata.creationTimestamp

# Health check via curl
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/health
```

### Alerting Thresholds

**Critical Alerts:**
- Pod crash loop: Immediate
- Memory usage >95%: Immediate
- Database connection failures: Immediate
- All replicas down: Immediate

**Warning Alerts:**
- Memory usage >85%: 5 minutes
- CPU usage >80%: 10 minutes
- High error rate >10%: 5 minutes
- Slow response time >5s: 10 minutes

## Troubleshooting Guide

### Common Issues

#### 1. Pod Crashes / CrashLoopBackOff

**Symptoms:**
- Pods restarting frequently
- Status shows `CrashLoopBackOff`
- Application unavailable

**Diagnosis:**
```bash
# Check pod status
oc get pods -l app=nanopore-tracking-app

# View logs
oc logs -f <pod-name>

# Check events
oc describe pod <pod-name>
```

**Common Causes & Solutions:**
- **Memory limit exceeded**: Increase memory limits or optimize memory usage
- **Database connection failure**: Check database connectivity and credentials
- **Missing environment variables**: Verify configmap and secrets
- **Port conflicts**: Ensure port 3001 is available

#### 2. High Memory Usage

**Symptoms:**
- Memory usage consistently >90%
- Pods being killed by OOMKiller
- Slow response times

**Diagnosis:**
```bash
# Check memory usage
oc top pods -l app=nanopore-tracking-app

# Get memory statistics
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/memory-optimize
```

**Solutions:**
1. **Immediate**: Force garbage collection
   ```bash
   curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/memory-optimize?action=gc
   ```

2. **Short-term**: Increase memory limits
   ```bash
   oc patch deployment nanopore-tracking-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"nanopore-tracking-app","resources":{"limits":{"memory":"400Mi"}}}]}}}}'
   ```

3. **Long-term**: Optimize application memory usage

#### 3. Database Connection Issues

**Symptoms:**
- Error: "Database connection failed"
- Slow query performance
- Connection pool exhaustion

**Diagnosis:**
```bash
# Check database health
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/health

# View connection pool status
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/metrics
```

**Solutions:**
1. **Check database connectivity**: Verify DATABASE_URL in secrets
2. **Optimize connection pool**: Adjust pool size in environment variables
3. **Restart pods**: Force new database connections

#### 4. AI Service Failures

**Symptoms:**
- PDF processing failures
- Circuit breaker open
- Fallback methods in use

**Diagnosis:**
```bash
# Check AI service health
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=health

# View AI service metrics
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=metrics
```

**Solutions:**
1. **Reset circuit breaker**:
   ```bash
   curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=reset-circuit-breaker
   ```

2. **Clear AI cache**:
   ```bash
   curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=clear-cache
   ```

3. **Check Ollama service**: Verify external AI service availability

#### 5. Storage Issues

**Symptoms:**
- File upload failures
- "No space left on device" errors
- Persistent volume issues

**Diagnosis:**
```bash
# Check PVC status
oc get pvc

# Check storage usage
oc exec -it <pod-name> -- df -h /app/uploads /app/data
```

**Solutions:**
1. **Increase PVC size**: Expand persistent volume claims
2. **Clean up old files**: Remove unnecessary uploaded files
3. **Check storage class**: Ensure proper storage configuration

### Performance Issues

#### Slow Response Times

**Diagnosis Steps:**
1. Check application metrics
2. Analyze database query performance
3. Review memory and CPU usage
4. Examine network latency

**Optimization Actions:**
1. **Scale horizontally**: Add more replicas
2. **Optimize database**: Add indexes, optimize queries
3. **Enable caching**: Implement Redis or in-memory caching
4. **CDN**: Use content delivery network for static assets

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks
- [ ] Check application health status
- [ ] Review error logs for anomalies
- [ ] Monitor resource usage trends
- [ ] Verify backup completion

#### Weekly Tasks
- [ ] Review performance metrics
- [ ] Check database performance
- [ ] Update security patches
- [ ] Clean up old logs and files

#### Monthly Tasks
- [ ] Review capacity planning
- [ ] Update documentation
- [ ] Test disaster recovery procedures
- [ ] Security audit

### Database Maintenance

#### Run Database Migration
```bash
# Check migration status
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/migrate?action=status

# Run pending migrations
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/migrate
```

#### Database Optimization
```bash
# Run database vacuum
oc exec -it <pod-name> -- psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check database statistics
oc exec -it <pod-name> -- psql $DATABASE_URL -c "SELECT * FROM pg_stat_user_tables;"
```

### Application Updates

#### Rolling Update Process
1. **Prepare**: Build new image with updated code
2. **Deploy**: Update deployment with new image
3. **Monitor**: Watch rollout progress
4. **Verify**: Test application functionality
5. **Rollback**: If issues occur, revert to previous version

```bash
# Start rolling update
oc set image deployment/nanopore-tracking-app nanopore-tracking-app=new-image:tag

# Monitor rollout
oc rollout status deployment/nanopore-tracking-app

# Rollback if needed
oc rollout undo deployment/nanopore-tracking-app
```

## Emergency Procedures

### Application Down (All Pods)

**Immediate Actions:**
1. **Check pod status**: `oc get pods -l app=nanopore-tracking-app`
2. **Review recent changes**: Check deployment history
3. **Check resource quotas**: Verify namespace limits
4. **Restart deployment**: `oc rollout restart deployment/nanopore-tracking-app`

**If restart fails:**
1. **Scale to zero**: `oc scale deployment nanopore-tracking-app --replicas=0`
2. **Wait 30 seconds**
3. **Scale back up**: `oc scale deployment nanopore-tracking-app --replicas=2`

### Database Emergency

**Connection Lost:**
1. **Check database service**: Verify database pod status
2. **Test connectivity**: Use database client to test connection
3. **Check secrets**: Verify DATABASE_URL is correct
4. **Restart application**: Force new database connections

**Data Corruption:**
1. **Stop application**: Scale to zero replicas
2. **Assess damage**: Check database integrity
3. **Restore from backup**: Use latest backup
4. **Verify data**: Test application functionality
5. **Resume service**: Scale back to normal

### Security Incident

**Suspected Breach:**
1. **Isolate**: Scale down to minimum replicas
2. **Investigate**: Check logs for suspicious activity
3. **Assess**: Determine scope of potential breach
4. **Notify**: Contact security team
5. **Remediate**: Apply security patches
6. **Monitor**: Increase logging and monitoring

## Performance Optimization

### Scaling Strategies

#### Vertical Scaling (Scale Up)
```bash
# Increase memory limit
oc patch deployment nanopore-tracking-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"nanopore-tracking-app","resources":{"limits":{"memory":"400Mi","cpu":"500m"}}}]}}}}'
```

#### Horizontal Scaling (Scale Out)
```bash
# Manual scaling
oc scale deployment nanopore-tracking-app --replicas=4

# Auto-scaling adjustment
oc patch hpa nanopore-tracking-app-hpa -p '{"spec":{"maxReplicas":8}}'
```

### Database Optimization

#### Connection Pool Tuning
```bash
# Update connection pool settings
oc set env deployment/nanopore-tracking-app DB_POOL_MIN=10 DB_POOL_MAX=30
```

#### Query Optimization
- Add database indexes for frequently queried fields
- Optimize slow queries using EXPLAIN ANALYZE
- Consider read replicas for heavy read workloads

### Caching Strategies

#### Application-Level Caching
- Enable AI service result caching
- Implement query result caching
- Use CDN for static assets

#### Database Caching
- Configure PostgreSQL shared_buffers
- Enable query plan caching
- Use connection pooling

## Security Operations

### Security Monitoring

#### Log Analysis
```bash
# Check security-related logs
oc logs -l app=nanopore-tracking-app | grep -i "error\|fail\|security\|unauthorized"

# Monitor authentication attempts
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/audit?category=auth
```

#### Security Headers Verification
```bash
# Check security headers
curl -I -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/
```

### Security Updates

#### Regular Security Tasks
1. **Update base images**: Keep container images current
2. **Patch dependencies**: Update npm packages
3. **Review access logs**: Check for suspicious activity
4. **Rotate secrets**: Update JWT and session secrets

#### Security Configuration
```bash
# Update security secrets
oc create secret generic nanopore-secrets \
  --from-literal=jwt-secret=<new-jwt-secret> \
  --from-literal=session-secret=<new-session-secret> \
  --from-literal=encryption-key=<new-encryption-key> \
  --dry-run=client -o yaml | oc apply -f -
```

## Backup & Recovery

### Backup Procedures

#### Database Backup
```bash
# Create database backup
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/backup

# Verify backup
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/backup?action=list
```

#### File System Backup
```bash
# Backup persistent volumes
oc exec -it <pod-name> -- tar -czf /tmp/uploads-backup.tar.gz /app/uploads
oc cp <pod-name>:/tmp/uploads-backup.tar.gz ./uploads-backup.tar.gz
```

### Recovery Procedures

#### Database Recovery
1. **Stop application**: Scale to zero replicas
2. **Restore database**: Use pg_restore or similar
3. **Verify data**: Check database integrity
4. **Start application**: Scale back to normal

#### File Recovery
1. **Stop application**: Scale to zero replicas
2. **Restore files**: Copy backup to persistent volume
3. **Set permissions**: Ensure correct file ownership
4. **Start application**: Scale back to normal

### Disaster Recovery

#### Complete System Recovery
1. **Assess damage**: Determine scope of failure
2. **Restore database**: From latest backup
3. **Restore files**: From persistent volume backup
4. **Redeploy application**: From known good configuration
5. **Verify functionality**: Test all major features
6. **Monitor closely**: Watch for issues

## Contact Information

### Escalation Contacts
- **Primary**: Development Team
- **Secondary**: System Administrators
- **Emergency**: On-call Engineer

### Support Resources
- **Documentation**: This runbook
- **Monitoring**: OpenShift Console
- **Logs**: Application logs via `oc logs`
- **Metrics**: Prometheus/Grafana dashboard

---

*Last Updated: [Current Date]*
*Version: 1.0*
*Next Review: [Next Month]* 