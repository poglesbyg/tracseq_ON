# Sample Management Service

A microservice for managing nanopore sequencing samples in the Nanopore Tracking Application.

## Overview

The Sample Management Service is responsible for:
- Creating, reading, updating, and deleting sample records
- Managing sample workflow status and assignments
- Validating sample data and chart fields
- Tracking workflow history
- Providing sample statistics and reporting

## Features

- **CRUD Operations**: Full Create, Read, Update, Delete operations for samples
- **Workflow Management**: Status tracking and transitions with validation
- **Assignment System**: Assign samples to team members
- **Search & Filtering**: Advanced search with pagination and filtering
- **Validation**: Input validation using Zod schemas
- **Audit Trail**: Complete workflow history tracking
- **Statistics**: Sample statistics and reporting
- **Health Monitoring**: Health checks and Prometheus metrics
- **Database Migration**: Automatic schema creation and migration

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│ Sample Service  │───▶│   PostgreSQL    │
│   (Port 3000)   │    │  (Port 3002)    │    │   (Port 5434)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Prometheus    │
                       │   (Metrics)     │
                       └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Local Development

1. **Install dependencies**:
   ```bash
   cd services/sample-management
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database configuration
   ```

3. **Start the service**:
   ```bash
   npm run dev
   ```

4. **Verify the service is running**:
   ```bash
   curl http://localhost:3002/health
   ```

### Docker Development

1. **Start all services**:
   ```bash
   cd deployment/docker
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Check service status**:
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

3. **View logs**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs sample-service
   ```

## API Documentation

### Base URL
```
http://localhost:3002
```

### Authentication
Currently, the service runs without authentication. In production, implement proper authentication middleware.

### Endpoints

#### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "sample-management",
  "version": "1.0.0",
  "database": "connected"
}
```

#### Metrics
```http
GET /metrics
```

Returns Prometheus metrics for monitoring.

#### Samples

##### Get All Samples
```http
GET /api/samples
```

**Query Parameters**:
- `status` - Filter by status (submitted, assigned, in_progress, completed, failed, cancelled)
- `priority` - Filter by priority (low, medium, high, urgent)
- `assignedTo` - Filter by assignee
- `submitterEmail` - Filter by submitter email
- `labName` - Filter by lab name
- `sampleType` - Filter by sample type (dna, rna, protein, other)
- `flowCellType` - Filter by flow cell type
- `chartField` - Filter by chart field

##### Search Samples with Pagination
```http
GET /api/samples/search?page=1&limit=20
```

**Response**:
```json
{
  "samples": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

##### Get Sample by ID
```http
GET /api/samples/{id}
```

##### Create Sample
```http
POST /api/samples
```

**Request Body**:
```json
{
  "sampleName": "Sample-001",
  "projectId": "PROJ-001",
  "submitterName": "John Doe",
  "submitterEmail": "john.doe@example.com",
  "labName": "Genomics Lab",
  "sampleType": "dna",
  "sampleBuffer": "TE Buffer",
  "concentration": 50.0,
  "volume": 100.0,
  "totalAmount": 5000.0,
  "flowCellType": "FLO-MIN106",
  "flowCellCount": 1,
  "priority": "medium",
  "assignedTo": "tech1",
  "libraryPrepBy": "tech1",
  "chartField": "HTSF-001"
}
```

##### Update Sample
```http
PUT /api/samples/{id}
```

##### Delete Sample
```http
DELETE /api/samples/{id}
```

##### Assign Sample
```http
POST /api/samples/{id}/assign
```

**Request Body**:
```json
{
  "assignedTo": "tech1",
  "libraryPrepBy": "tech1"
}
```

##### Update Sample Status
```http
POST /api/samples/{id}/status
```

**Request Body**:
```json
{
  "status": "in_progress"
}
```

##### Get Workflow History
```http
GET /api/samples/{id}/history
```

#### Chart Fields

##### Get Active Chart Fields
```http
GET /api/chart-fields
```

##### Validate Chart Field
```http
POST /api/chart-fields/validate
```

**Request Body**:
```json
{
  "chartField": "HTSF-001"
}
```

#### Statistics

##### Get Sample Statistics
```http
GET /api/statistics
```

**Response**:
```json
{
  "totalSamples": 150,
  "samplesByStatus": {
    "submitted": 20,
    "assigned": 15,
    "in_progress": 10,
    "completed": 100,
    "failed": 3,
    "cancelled": 2
  },
  "samplesByPriority": {
    "low": 30,
    "medium": 80,
    "high": 35,
    "urgent": 5
  },
  "recentSamples": 25
}
```

## Data Models

### Sample Status Flow
```
submitted → assigned → in_progress → completed
     ↓         ↓           ↓           ↓
  cancelled  cancelled  cancelled    (end)
     ↓           ↓           ↓
  failed → in_progress (retry)
```

### Sample Priority Levels
- `low` - Standard priority
- `medium` - Normal priority (default)
- `high` - High priority
- `urgent` - Critical priority

### Sample Types
- `dna` - DNA samples
- `rna` - RNA samples
- `protein` - Protein samples
- `other` - Other sample types

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `3002` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `sample_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_SSL` | Enable SSL | `false` |
| `DB_MAX_CONNECTIONS` | Connection pool size | `10` |
| `LOG_LEVEL` | Logging level | `info` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3001` |

## Database Schema

### Tables

#### samples
- `id` (UUID, Primary Key)
- `sample_name` (VARCHAR)
- `project_id` (VARCHAR)
- `submitter_name` (VARCHAR)
- `submitter_email` (VARCHAR)
- `lab_name` (VARCHAR)
- `sample_type` (VARCHAR)
- `sample_buffer` (VARCHAR)
- `concentration` (DECIMAL)
- `volume` (DECIMAL)
- `total_amount` (DECIMAL)
- `flow_cell_type` (VARCHAR)
- `flow_cell_count` (INTEGER)
- `status` (VARCHAR)
- `priority` (VARCHAR)
- `assigned_to` (VARCHAR)
- `library_prep_by` (VARCHAR)
- `chart_field` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### workflow_history
- `id` (UUID, Primary Key)
- `sample_id` (UUID, Foreign Key)
- `status` (VARCHAR)
- `assigned_to` (VARCHAR)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `created_by` (VARCHAR)

#### sample_assignments
- `id` (UUID, Primary Key)
- `sample_id` (UUID, Foreign Key)
- `assigned_to` (VARCHAR)
- `assigned_by` (VARCHAR)
- `assigned_at` (TIMESTAMP)
- `status` (VARCHAR)
- `notes` (TEXT)

#### chart_fields
- `id` (UUID, Primary Key)
- `chart_field` (VARCHAR, Unique)
- `description` (TEXT)
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Monitoring

### Health Checks
- Service health: `GET /health`
- Database connectivity
- Service version and status

### Metrics
- Prometheus metrics: `GET /metrics`
- Request counts and response times
- Database connection pool stats
- Error rates

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking with stack traces
- Performance monitoring

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Deployment

### Production Build
```bash
npm run build
```

### Docker Build
```bash
docker build -f deployment/docker/Dockerfile.sample-service -t sample-management-service .
```

### Kubernetes Deployment
See the Kubernetes manifests in the `deployment/kubernetes/` directory.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check database URL and credentials
   - Verify database is running
   - Check network connectivity

2. **Service Won't Start**
   - Check environment variables
   - Verify port availability
   - Check logs for errors

3. **Validation Errors**
   - Ensure all required fields are provided
   - Check data types and formats
   - Verify chart field exists

### Logs
```bash
# View service logs
docker-compose logs sample-service

# Follow logs
docker-compose logs -f sample-service

# View specific log level
docker-compose logs sample-service | grep ERROR
```

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.