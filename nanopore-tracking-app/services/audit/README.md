# Audit Service

A comprehensive audit logging, event tracking, and monitoring microservice for the Nanopore Tracking Application.

## Features

- **Audit Event Logging**: Track all system events with detailed metadata
- **Audit Log Management**: Structured application logging with different levels
- **User Activity Tracking**: Monitor user behavior and interactions
- **Statistics & Metrics**: Real-time analytics and performance metrics
- **Report Generation**: Automated and custom reports in multiple formats
- **Real-time Alerting**: Configurable alerts for security and operational events
- **Data Retention Management**: Automatic cleanup of old audit data
- **Bulk Operations**: Efficient batch processing of audit data
- **Health Monitoring**: Comprehensive health checks and monitoring

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Other Services │    │   Frontend      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Audit Service         │
                    │  ┌─────────────────────┐  │
                    │  │   Express Server    │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │   AuditService      │  │
                    │  │   Business Logic    │  │
                    │  └─────────┬───────────┘  │
                    │            │              │
                    │  ┌─────────▼───────────┐  │
                    │  │   PostgreSQL DB     │  │
                    │  │   Audit Tables      │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   cd services/audit
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database configuration
   ```

3. **Set up the database:**
   ```bash
   # Create database and run migrations
   npm run db:migrate
   ```

4. **Start the service:**
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:3006`

### Docker Deployment

1. **Build the image:**
   ```bash
   docker build -t audit-service .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name audit-service \
     -p 3006:3006 \
     -e AUDIT_DB_HOST=your-db-host \
     -e AUDIT_DB_NAME=audit_db \
     -e AUDIT_DB_USER=postgres \
     -e AUDIT_DB_PASSWORD=password \
     audit-service
   ```

## API Endpoints

### Health & Discovery

- `GET /health` - Service health check
- `GET /discovery` - Service capabilities and endpoints
- `GET /` - Service information

### Audit Events

- `POST /api/events` - Create audit event
- `GET /api/events` - Get audit events with filtering

### Audit Logs

- `POST /api/logs` - Create audit log
- `GET /api/logs` - Get audit logs with filtering

### User Activities

- `POST /api/activities` - Create user activity
- `GET /api/activities` - Get user activities with filtering

### Statistics & Metrics

- `GET /api/stats` - Get audit statistics
- `GET /api/metrics` - Get activity metrics

### Reports

- `POST /api/reports` - Create audit report
- `GET /api/reports/:reportId/generate` - Generate report

### Alerts

- `POST /api/alerts` - Create audit alert

### Data Management

- `POST /api/cleanup` - Clean up old data
- `POST /api/bulk` - Bulk operations

## Data Models

### Audit Event

```typescript
interface AuditEvent {
  id: string
  timestamp: Date
  userId?: string
  userEmail?: string
  service: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  severity: 'info' | 'warn' | 'error' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security'
  tags?: string[]
  metadata?: Record<string, any>
}
```

### User Activity

```typescript
interface UserActivity {
  id: string
  userId: string
  userEmail: string
  timestamp: Date
  action: string
  service: string
  resource: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  duration?: number
  success: boolean
  details?: Record<string, any>
}
```

### Audit Log

```typescript
interface AuditLog {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, any>
  stackTrace?: string
  tags?: string[]
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIT_SERVICE_PORT` | Service port | `3006` |
| `AUDIT_DB_HOST` | Database host | `localhost` |
| `AUDIT_DB_PORT` | Database port | `5432` |
| `AUDIT_DB_NAME` | Database name | `audit_db` |
| `AUDIT_DB_USER` | Database user | `postgres` |
| `AUDIT_DB_PASSWORD` | Database password | `password` |
| `AUDIT_RETENTION_DAYS` | Data retention period | `90` |
| `AUDIT_MAX_EVENTS_PER_REQUEST` | Max events per request | `1000` |
| `AUDIT_ENABLE_REALTIME_ALERTS` | Enable real-time alerts | `true` |
| `AUDIT_ENABLE_SCHEDULED_REPORTS` | Enable scheduled reports | `true` |
| `AUDIT_ENABLE_DATA_RETENTION` | Enable data retention | `true` |
| `CORS_ORIGIN` | CORS origin | `*` |
| `NODE_ENV` | Environment | `development` |

### Database Schema

The service creates the following tables:

- `audit_events` - Main audit trail
- `audit_logs` - Application logs
- `user_activities` - User behavior tracking
- `audit_reports` - Report configurations
- `audit_alerts` - Alert configurations
- `audit_alert_history` - Alert trigger history

## Usage Examples

### Creating an Audit Event

```bash
curl -X POST http://localhost:3006/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "service": "sample-service",
    "action": "create",
    "resource": "sample",
    "userId": "user123",
    "userEmail": "user@example.com",
    "details": {
      "sampleId": "sample-456",
      "priority": "high"
    },
    "severity": "info",
    "category": "data_modification"
  }'
```

### Creating a User Activity

```bash
curl -X POST http://localhost:3006/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "userEmail": "user@example.com",
    "action": "login",
    "service": "auth-service",
    "resource": "session",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "success": true,
    "duration": 150
  }'
```

### Getting Audit Statistics

```bash
curl "http://localhost:3006/api/stats?daysBack=30"
```

### Creating a Report

```bash
curl -X POST http://localhost:3006/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Security Report",
    "description": "Daily security events summary",
    "type": "security",
    "filters": {
      "category": "security",
      "severity": ["error", "critical"]
    },
    "format": "csv",
    "schedule": "0 9 * * *"
  }'
```

### Creating an Alert

```bash
curl -X POST http://localhost:3006/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Error Rate Alert",
    "description": "Alert when error rate exceeds threshold",
    "condition": {
      "field": "severity",
      "operator": "equals",
      "value": "error"
    },
    "severity": "high",
    "service": "all",
    "recipients": ["admin@example.com"],
    "cooldownMinutes": 60
  }'
```

## Monitoring

### Health Checks

The service provides comprehensive health checks:

```bash
curl http://localhost:3006/health
```

### Metrics

Access service metrics:

```bash
curl http://localhost:3006/api/metrics
```

### Logs

Logs are written to:
- Console (development)
- `/app/logs/audit-YYYY-MM-DD.log` (production)
- `/app/logs/audit-error-YYYY-MM-DD.log` (errors only)

## Security

### Rate Limiting

- 1000 requests per 15 minutes per IP
- Configurable limits per endpoint

### Input Validation

- All inputs validated with express-validator
- SQL injection protection via Kysely ORM
- XSS protection via helmet

### Authentication

- JWT token validation (when integrated)
- Session-based authentication support
- IP address tracking

## Performance

### Database Optimization

- Indexed queries for common filters
- Connection pooling
- Query optimization

### Caching

- Response caching for statistics
- Database query result caching
- Memory optimization

### Scalability

- Horizontal scaling support
- Load balancer ready
- Stateless design

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check database credentials
   - Verify database is running
   - Check network connectivity

2. **High Memory Usage**
   - Monitor log file sizes
   - Check for memory leaks
   - Adjust retention settings

3. **Slow Queries**
   - Check database indexes
   - Optimize query filters
   - Monitor query performance

### Logs

Check logs for detailed error information:

```bash
# Development
npm run dev

# Production
docker logs audit-service
```

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details