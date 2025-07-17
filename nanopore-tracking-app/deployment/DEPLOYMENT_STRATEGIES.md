# OpenShift Deployment Strategies

## Overview

With the increased pod and service limits (15 each), you now have multiple deployment strategies available for the Nanopore Tracking Application. This document outlines the available strategies and when to use each one.

## Available Deployment Strategies

### 1. 🚀 Enhanced Deployment (Recommended)
**Best for: Production environments with ample resources**

**Resource Requirements:**
- Pods: 8+ available (uses 3-5 + monitoring)
- Services: 5+ available (uses 2-3)
- Storage: 4Gi total
- Memory: ~1Gi total

**Features:**
- ✅ Multi-replica deployment (3 replicas)
- ✅ Horizontal Pod Autoscaling (2-5 replicas)
- ✅ Multiple services (app + metrics)
- ✅ Enhanced persistent storage (2Gi each)
- ✅ Pod disruption budgets for high availability
- ✅ Network policies for security
- ✅ Comprehensive monitoring integration
- ✅ Full service mesh features
- ✅ Advanced health checks and probes

**Deployment Command:**
```bash
./deployment/scripts/deploy-enhanced.sh
```

### 2. ⚖️ Balanced Deployment
**Best for: Moderate resource environments**

**Resource Requirements:**
- Pods: 3-7 available (uses 2-3)
- Services: 2-4 available (uses 1-2)
- Storage: 2Gi total
- Memory: ~512Mi total

**Features:**
- ✅ Dual-replica deployment (2 replicas)
- ✅ Basic autoscaling (if supported)
- ✅ Primary service
- ✅ Standard persistent storage (1Gi each)
- ✅ Basic health checks
- ✅ Integrated service mesh
- ⚠️ Limited monitoring

**Deployment Command:**
```bash
./deployment/scripts/deploy-openshift-auto.sh --force-strategy balanced
```

### 3. 🔧 Resource-Optimized Deployment
**Best for: Constrained environments**

**Resource Requirements:**
- Pods: 1+ available (uses 1)
- Services: 0+ available (reuses existing)
- Storage: 1Gi total
- Memory: ~256Mi total

**Features:**
- ✅ Single-replica deployment (1 replica)
- ✅ Minimal resource usage
- ✅ Existing service reuse
- ✅ Compact persistent storage (500Mi each)
- ✅ Essential health checks
- ✅ Integrated service mesh (no sidecar)
- ⚠️ Basic monitoring only

**Deployment Command:**
```bash
./deployment/scripts/deploy-resource-optimized.sh
```

## 🤖 Automatic Strategy Selection

The intelligent deployment selector automatically chooses the best strategy based on your current resource availability:

```bash
./deployment/scripts/deploy-openshift-auto.sh
```

**Selection Logic:**
- **Enhanced**: ≥8 pods + ≥5 services available
- **Balanced**: ≥3 pods + ≥2 services available  
- **Resource-Optimized**: ≥1 pod + ≥0 services available

## Deployment Files

### Enhanced Deployment Configuration
- **File**: `deployment/openshift/enhanced-deployment.yaml`
- **Features**: Full-featured deployment with all capabilities
- **Components**: Deployment, Services, HPA, PDB, NetworkPolicy, PVCs

### Resource-Optimized Configuration
- **File**: `deployment/openshift/resource-optimized-deployment.yaml`
- **Features**: Minimal resource usage, single pod
- **Components**: Deployment, PVCs, optimized ConfigMap

### Common Configuration
- **Secrets**: `deployment/openshift/secret.yaml`
- **ConfigMap**: `deployment/openshift/configmap.yaml`
- **Service Account**: `deployment/openshift/service-account-namespace-scoped.yaml`

## Resource Monitoring

### Enhanced Deployment Monitoring
```bash
# Monitor autoscaling
oc get hpa nanopore-tracking-hpa -w

# Check pod resource usage
oc top pods -l app=nanopore-tracking-app

# View events
oc get events --sort-by=.metadata.creationTimestamp
```

### Resource-Optimized Monitoring
```bash
# Monitor single pod
oc get pods -l app=nanopore-tracking-app -w

# Check resource usage
oc top pod -l app=nanopore-tracking-app

# Monitor quota usage
oc describe quota default-quota
```

## Scaling Paths

### From Resource-Optimized to Balanced
**Requirements:** Increase quota to 3 pods, 2 services
```bash
# Request quota increase, then:
./deployment/scripts/deploy-openshift-auto.sh --force-strategy balanced
```

### From Balanced to Enhanced
**Requirements:** Increase quota to 8 pods, 5 services
```bash
# Request quota increase, then:
./deployment/scripts/deploy-enhanced.sh
```

## Configuration Management

### Environment Variables by Strategy

#### Enhanced Deployment
- Full ConfigMap with all optimization settings
- Comprehensive environment variable configuration
- Performance tuning parameters
- Service mesh full configuration

#### Resource-Optimized Deployment
- Minimal ConfigMap with essential settings
- Optimized environment variables
- Memory-conscious configuration
- Integrated service mesh settings

### Database Connection Pooling

#### Enhanced Strategy
```yaml
DB_POOL_MIN: "2"
DB_POOL_MAX: "8"
DB_CONNECTION_TIMEOUT: "10000"
DB_IDLE_TIMEOUT: "30000"
```

#### Resource-Optimized Strategy
```yaml
DB_POOL_MIN: "1"
DB_POOL_MAX: "3"
DB_CONNECTION_TIMEOUT: "5000"
DB_IDLE_TIMEOUT: "20000"
```

## Security Features

### Enhanced Deployment Security
- Network policies for ingress/egress control
- Pod security contexts with restricted permissions
- Service mesh security features
- Mutual TLS (if supported)
- AppArmor and seccomp profiles

### Resource-Optimized Security
- Basic security contexts
- Essential security constraints
- Integrated security features
- Minimal attack surface

## Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check deployment status
oc describe deployment nanopore-tracking-app

# View pod logs
oc logs -l app=nanopore-tracking-app --tail=100

# Check events
oc get events --sort-by=.metadata.creationTimestamp
```

#### Resource Constraints
```bash
# Check current quota usage
oc describe quota default-quota

# View resource usage
oc top pods -l app=nanopore-tracking-app
```

#### Health Check Failures
```bash
# Test health endpoint
oc exec <pod-name> -- curl -f http://localhost:3001/health

# Check service connectivity
oc get services -l app=nanopore-tracking-app
```

### Recovery Procedures

#### Rollback Deployment
```bash
# Rollback to previous version
oc rollout undo deployment/nanopore-tracking-app

# Check rollout status
oc rollout status deployment/nanopore-tracking-app
```

#### Emergency Scale Down
```bash
# Scale to minimum replicas
oc scale deployment nanopore-tracking-app --replicas=1

# Disable autoscaling temporarily
oc patch hpa nanopore-tracking-hpa -p '{"spec":{"minReplicas":1,"maxReplicas":1}}'
```

## Best Practices

### 1. Resource Planning
- Monitor resource usage patterns
- Plan for peak load scenarios
- Set appropriate resource requests/limits
- Use autoscaling for dynamic workloads

### 2. Deployment Strategy Selection
- Start with automatic selection
- Use enhanced for production workloads
- Use resource-optimized for development/testing
- Scale up as resources become available

### 3. Monitoring and Alerting
- Set up resource usage alerts
- Monitor application performance metrics
- Track deployment success rates
- Implement health check monitoring

### 4. Maintenance
- Regular deployment updates
- Resource quota reviews
- Performance tuning
- Security updates

## Next Steps

1. **Choose Your Strategy**: Use the automatic selector or choose based on your requirements
2. **Deploy**: Run the appropriate deployment script
3. **Monitor**: Set up monitoring and alerting
4. **Scale**: Plan for future resource needs
5. **Optimize**: Tune performance based on usage patterns

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review deployment logs and events
3. Consult OpenShift documentation
4. Contact your platform team for quota increases 