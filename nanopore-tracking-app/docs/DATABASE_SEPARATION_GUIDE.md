# Database Separation Implementation Guide

## Overview

This guide documents the implementation of **Phase 1: Database Separation** for the nanopore tracking application's microservices architecture. The transformation moves from a single monolithic database to service-specific databases optimized for each microservice.

## Architecture Transformation

### Before: Monolithic Database
```
┌─────────────────────────────────────┐
│         Single Database             │
├─────────────────────────────────────┤
│  • nanopore_samples                 │
│  • nanopore_sample_details          │
│  • nanopore_processing_steps        │
│  • nanopore_attachments             │
│  • users                            │
│  • (all other tables)               │
└─────────────────────────────────────┘
```

### After: Service-Specific Databases
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Samples DB     │  │    AI DB        │  │   Audit DB      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • samples       │  │ • extraction    │  │ • audit_logs    │
│ • sample_details│  │ • processing    │  │ • compliance    │
│ • processing    │  │ • performance   │  │ • retention     │
│ • attachments   │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐
│   Backup DB     │  │   Config DB     │
├─────────────────┤  ├─────────────────┤
│ • backup_jobs   │  │ • app_configs   │
│ • schedules     │  │ • feature_flags │
│ • metadata      │  │ • config_history│
└─────────────────┘  └─────────────────┘
```

## Service Database Schemas

### 1. Samples Database (`nanopore_samples`)
**Purpose**: Core sample management and tracking
**Tables**:
- `nanopore_samples` - Main sample records
- `nanopore_sample_details` - Extended sample metadata
- `nanopore_processing_steps` - Workflow step tracking
- `nanopore_attachments` - File attachments

**Key Features**:
- Optimized for CRUD operations
- Full-text search capabilities
- Workflow state management
- File attachment tracking

### 2. AI Database (`nanopore_ai`)
**Purpose**: AI processing results and job management
**Tables**:
- `ai_extraction_results` - PDF extraction results
- `ai_processing_jobs` - Job queue and tracking
- `ai_model_performance` - Model performance metrics

**Key Features**:
- Confidence scoring and validation
- Processing method tracking (LLM, pattern, hybrid, RAG)
- Performance analytics
- Job queue management

### 3. Audit Database (`nanopore_audit`)
**Purpose**: Comprehensive audit logging and compliance
**Tables**:
- `audit_logs` - Complete audit trail
- `compliance_reports` - Regulatory compliance reports
- `retention_policies` - Data retention rules

**Key Features**:
- Immutable audit records
- Compliance reporting
- Data retention management
- Security event tracking

### 4. Backup Database (`nanopore_backup`)
**Purpose**: Backup job management and metadata
**Tables**:
- `backup_jobs` - Individual backup executions
- `backup_schedules` - Automated backup schedules
- `backup_metadata` - Backup content metadata

**Key Features**:
- Scheduled backup management
- Compression and encryption tracking
- Backup verification
- Retention policy enforcement

### 5. Config Database (`nanopore_config`)
**Purpose**: Application configuration and feature flags
**Tables**:
- `application_configs` - Environment-specific configurations
- `feature_flags` - Feature toggle management
- `config_history` - Configuration change tracking

**Key Features**:
- Environment-specific settings
- Feature flag rollouts
- Configuration change auditing
- Encrypted sensitive values

## Implementation Components

### 1. Service Database Manager
**File**: `src/lib/database/service-databases.ts`

```typescript
// Service-specific database connections
export const samplesDb = () => serviceDatabaseManager.getSamplesDatabase()
export const aiDb = () => serviceDatabaseManager.getAIDatabase()
export const auditDb = () => serviceDatabaseManager.getAuditDatabase()
export const backupDb = () => serviceDatabaseManager.getBackupDatabase()
export const configDb = () => serviceDatabaseManager.getConfigDatabase()
```

**Features**:
- Connection pooling per service
- Health monitoring
- Graceful shutdown
- Performance metrics

### 2. Service-Specific Repositories

#### Samples Repository
**File**: `src/repositories/SamplesRepository.ts`
- Full CRUD operations
- Advanced search capabilities
- Workflow management
- Attachment handling

#### AI Repository
**File**: `src/repositories/AIRepository.ts`
- Extraction result management
- Processing job queue
- Performance tracking
- Analytics and reporting

#### Audit Repository
**File**: `src/repositories/AuditRepository.ts`
- Audit log creation
- Compliance reporting
- Data retention management
- Security analytics

### 3. Database Migrations
**Directory**: `database/service-migrations/`
- `001_create_ai_database.sql` - AI service schema
- `002_create_audit_database.sql` - Audit service schema
- `003_create_backup_database.sql` - Backup service schema
- `004_create_config_database.sql` - Config service schema

### 4. Migration Script
**File**: `scripts/migrate-to-service-databases.js`
- Automated migration from monolithic to service databases
- Data validation and verification
- Rollback capabilities
- Progress reporting

## Configuration

### Environment Variables
```bash
# Service-specific database URLs
SAMPLES_DB_URL=postgresql://user:pass@localhost:5432/nanopore_samples
AI_DB_URL=postgresql://user:pass@localhost:5432/nanopore_ai
AUDIT_DB_URL=postgresql://user:pass@localhost:5432/nanopore_audit
BACKUP_DB_URL=postgresql://user:pass@localhost:5432/nanopore_backup
CONFIG_DB_URL=postgresql://user:pass@localhost:5432/nanopore_config

# Fallback to main database for development
DATABASE_URL=postgresql://user:pass@localhost:5432/nanopore_tracking
```

### Connection Pool Configuration
```typescript
// Service-specific connection limits
const connectionLimits = {
  samples: { max: 20, min: 5 },  // High traffic
  ai: { max: 15, min: 3 },       // Processing intensive
  audit: { max: 10, min: 2 },    // Write-heavy
  backup: { max: 5, min: 1 },    // Background jobs
  config: { max: 5, min: 1 }     // Low traffic
}
```

## Migration Process

### 1. Pre-Migration Checklist
- [ ] Backup existing database
- [ ] Verify all services are stopped
- [ ] Ensure database permissions
- [ ] Test migration script in development

### 2. Migration Steps
```bash
# 1. Run the migration script
node scripts/migrate-to-service-databases.js

# 2. Verify migration results
npm run verify-migration

# 3. Update environment variables
# 4. Restart services with new configuration
```

### 3. Post-Migration Verification
- [ ] All services start successfully
- [ ] Data integrity checks pass
- [ ] Performance metrics are normal
- [ ] Backup processes work correctly

## Performance Optimizations

### 1. Connection Pooling
- Service-specific pool sizes
- Connection reuse optimization
- Idle connection management
- Connection health monitoring

### 2. Query Optimization
- Service-specific indexes
- Query plan analysis
- Batch operation support
- Prepared statement caching

### 3. Data Access Patterns
- Read/write separation potential
- Caching strategies
- Async processing optimization
- Connection multiplexing

## Monitoring and Observability

### 1. Database Metrics
- Connection pool utilization
- Query performance
- Error rates
- Transaction volumes

### 2. Service Health Checks
```typescript
// Health check endpoint
async function healthCheck() {
  const results = await serviceDatabaseManager.healthCheck()
  return {
    status: Object.values(results).every(Boolean) ? 'healthy' : 'unhealthy',
    services: results,
    timestamp: new Date().toISOString()
  }
}
```

### 3. Alerting
- Connection pool exhaustion
- Query timeout alerts
- Replication lag monitoring
- Disk space warnings

## Benefits Achieved

### 1. Scalability
- **Independent scaling**: Each service can scale its database independently
- **Optimized resources**: Right-sized connections and resources per service
- **Horizontal scaling**: Easier to implement read replicas per service

### 2. Performance
- **Reduced contention**: No cross-service database locks
- **Optimized queries**: Service-specific query patterns and indexes
- **Faster backups**: Smaller, focused database backups

### 3. Reliability
- **Fault isolation**: Service database failures don't affect other services
- **Independent maintenance**: Database maintenance per service
- **Disaster recovery**: Service-specific backup and recovery strategies

### 4. Security
- **Data isolation**: Sensitive data separated by service boundaries
- **Access control**: Fine-grained database permissions
- **Audit trails**: Service-specific audit logging

## Troubleshooting

### Common Issues

#### 1. Connection Pool Exhaustion
```bash
# Symptoms
Error: Connection pool exhausted

# Solution
- Increase pool size for affected service
- Check for connection leaks
- Implement connection timeout
```

#### 2. Migration Failures
```bash
# Symptoms
Migration script errors

# Solution
- Check database permissions
- Verify source data integrity
- Run migration in smaller batches
```

#### 3. Performance Degradation
```bash
# Symptoms
Slow query performance

# Solution
- Analyze query plans
- Add missing indexes
- Optimize connection pools
```

## Next Steps

With database separation complete, the next phases are:

### Phase 2: Service Communication
- Implement async messaging between services
- Event-driven architecture
- Message queues and event streams

### Phase 3: Production Deployment
- Kubernetes service mesh integration
- Advanced monitoring and alerting
- Blue-green deployment strategies

### Phase 4: Performance Optimization
- Load testing and tuning
- Caching strategies
- Database optimization

### Phase 5: Security Hardening
- Zero-trust security model
- Service-to-service authentication
- Compliance frameworks

## Conclusion

The database separation implementation successfully transforms the nanopore tracking application from a monolithic database architecture to a microservices-ready, service-specific database architecture. This foundation enables:

- **Independent service scaling**
- **Improved performance and reliability**
- **Enhanced security and compliance**
- **Easier maintenance and monitoring**

The implementation provides a solid foundation for the remaining phases of the microservices transformation, enabling the application to scale efficiently and maintain high performance as it grows. 