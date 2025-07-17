# Nanopore Tracking App - Quick Reference Guide

## Essential Commands

### Health & Status Checks
```bash
# Application health
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/health

# Pod status
oc get pods -l app=nanopore-tracking-app

# Resource usage
oc top pods -l app=nanopore-tracking-app

# Application logs
oc logs -f deployment/nanopore-tracking-app

# Recent events
oc get events --sort-by=.metadata.creationTimestamp
```

### Scaling Operations
```bash
# Manual scaling
oc scale deployment nanopore-tracking-app --replicas=3

# Check HPA status
oc get hpa nanopore-tracking-app-hpa

# Update HPA limits
oc patch hpa nanopore-tracking-app-hpa -p '{"spec":{"maxReplicas":6}}'
```

### Memory Management
```bash
# Check memory usage
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/memory-optimize

# Force garbage collection
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/memory-optimize?action=gc

# Increase memory limits
oc patch deployment nanopore-tracking-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"nanopore-tracking-app","resources":{"limits":{"memory":"400Mi"}}}]}}}}'
```

### AI Service Management
```bash
# AI service health
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=health

# AI service metrics
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=metrics

# Reset circuit breaker
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=reset-circuit-breaker

# Clear AI cache
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=clear-cache
```

### Database Operations
```bash
# Database migration status
curl -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/migrate?action=status

# Run migrations
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/migrate

# Database backup
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/backup
```

### Emergency Procedures
```bash
# Restart deployment
oc rollout restart deployment/nanopore-tracking-app

# Emergency scale down/up
oc scale deployment nanopore-tracking-app --replicas=0
oc scale deployment nanopore-tracking-app --replicas=2

# Rollback deployment
oc rollout undo deployment/nanopore-tracking-app
```

## Key Endpoints

| Endpoint | Purpose | Method |
|----------|---------|---------|
| `/health` | Application health check | GET |
| `/api/metrics` | System metrics | GET |
| `/api/memory-optimize` | Memory management | GET/POST |
| `/api/ai-service` | AI service operations | GET/POST |
| `/api/migrate` | Database migrations | GET/POST |
| `/api/backup` | Database backup | GET/POST |
| `/api/audit` | Audit logs | GET |

## Alert Thresholds

### Critical (Immediate Response)
- Pod crash loop
- Memory usage >95%
- Database connection failures
- All replicas down

### Warning (5-10 minutes)
- Memory usage >85%
- CPU usage >80%
- Error rate >10%
- Response time >5s

## Resource Limits

### Current Configuration
- **Memory**: 320Mi limit, 160Mi request
- **CPU**: 300m limit, 100m request
- **Replicas**: 2 min, 6 max
- **Storage**: 2Gi uploads, 1Gi app data

### Scaling Targets
- **CPU**: 70% utilization
- **Memory**: 80% utilization

## Common Issues & Quick Fixes

### High Memory Usage
1. `curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/memory-optimize?action=gc`
2. `oc patch deployment nanopore-tracking-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"nanopore-tracking-app","resources":{"limits":{"memory":"400Mi"}}}]}}}}'`

### AI Service Issues
1. `curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=reset-circuit-breaker`
2. `curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=clear-cache`

### Database Connection Issues
1. Check secrets: `oc get secret nanopore-secrets`
2. Restart pods: `oc rollout restart deployment/nanopore-tracking-app`

### Pod Crashes
1. Check logs: `oc logs -f deployment/nanopore-tracking-app`
2. Check events: `oc describe pod <pod-name>`
3. Restart: `oc rollout restart deployment/nanopore-tracking-app`

## Monitoring URLs

- **Application**: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu
- **Health**: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/health
- **Metrics**: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/metrics
- **AI Health**: https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/ai-service?action=health

## Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string
- `DB_POOL_MIN`: Minimum connections (default: 5)
- `DB_POOL_MAX`: Maximum connections (default: 20)

### AI Services
- `OLLAMA_HOST`: Ollama service URL
- `ENABLE_AI_FEATURES`: Enable/disable AI features

### Application
- `NODE_ENV`: Environment (production)
- `PORT`: Application port (3001)
- `LOG_LEVEL`: Logging level (info)

## Secrets Management

### Update Secrets
```bash
oc create secret generic nanopore-secrets \
  --from-literal=database-url=<new-db-url> \
  --from-literal=jwt-secret=<new-jwt> \
  --from-literal=session-secret=<new-session> \
  --from-literal=encryption-key=<new-key> \
  --dry-run=client -o yaml | oc apply -f -
```

### View Secrets (base64 encoded)
```bash
oc get secret nanopore-secrets -o yaml
```

## Backup & Recovery

### Quick Backup
```bash
# Database backup
curl -X POST -k https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu/api/backup

# File backup
oc exec -it <pod-name> -- tar -czf /tmp/backup.tar.gz /app/uploads /app/data
oc cp <pod-name>:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

### Quick Recovery
```bash
# Scale down
oc scale deployment nanopore-tracking-app --replicas=0

# Restore files
oc cp backup-20240101.tar.gz <pod-name>:/tmp/
oc exec -it <pod-name> -- tar -xzf /tmp/backup-20240101.tar.gz -C /

# Scale up
oc scale deployment nanopore-tracking-app --replicas=2
```

---

*For detailed procedures, see the full Production Runbook* 