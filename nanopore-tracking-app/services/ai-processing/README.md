# AI Processing Service

A microservice for AI-powered PDF processing, data extraction, and vector search capabilities for the Nanopore Tracking Application.

## Features

- **PDF Processing**: Extract text and structured data from PDF files
- **AI-Powered Extraction**: Use LLM (Ollama) for intelligent data extraction
- **Vector Search**: Store and search document embeddings using Qdrant
- **Form Validation**: Validate extracted data against business rules
- **RAG System**: Question answering using Retrieval Augmented Generation
- **Job Management**: Track and manage processing jobs
- **Monitoring**: Prometheus metrics and health checks

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PDF Upload    │    │   AI Service    │    │  Vector DB      │
│   (Multer)      │    │   (Ollama)      │    │   (Qdrant)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Jobs/Data)   │
                    └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Ollama (for LLM processing)
- Qdrant (for vector storage)

### Environment Variables

Create a `.env` file:

```env
# Service Configuration
PORT=3003
NODE_ENV=development
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/ai_processing_db
# OR individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_processing_db
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false

# AI Service Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Vector Database Configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=nanopore_docs

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t ai-processing-service .

# Run container
docker run -p 3003:3003 \
  -e DATABASE_URL=postgresql://user:password@host:5432/db \
  -e OLLAMA_URL=http://ollama:11434 \
  -e QDRANT_URL=http://qdrant:6333 \
  ai-processing-service
```

## API Documentation

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ai-processing-service",
  "version": "1.0.0",
  "services": {
    "ai": true,
    "vector": true,
    "pdf": true
  },
  "database": "healthy"
}
```

### Process PDF

```http
POST /api/process/pdf
Content-Type: multipart/form-data

file: [PDF file]
sampleId: "sample-123"
processingType: "pdf_extraction"
metadata: "{\"priority\":\"high\"}"
```

Response:
```json
{
  "jobId": "uuid",
  "status": "completed",
  "result": {
    "extractedFields": [
      {
        "fieldName": "sample_name",
        "value": "Sample-001",
        "confidence": 0.95,
        "confidenceLevel": "very_high",
        "source": "pdf_regex"
      }
    ],
    "confidence": 0.85,
    "confidenceLevel": "high",
    "processingTime": 2500,
    "pagesProcessed": 1,
    "validationScore": 1.0
  },
  "processingTime": 2.5
}
```

### Extract Data from Text

```http
POST /api/extract/text
Content-Type: application/json

{
  "text": "Sample name: Sample-001, Project ID: PRJ-123",
  "sampleId": "sample-123",
  "extractionPrompt": "Extract sample information",
  "fields": ["sample_name", "project_id"]
}
```

### Search Similar Documents

```http
POST /api/search/similar
Content-Type: application/json

{
  "query": "nanopore sequencing protocol",
  "limit": 10,
  "threshold": 0.7
}
```

### Validate Form Data

```http
POST /api/validate/form
Content-Type: application/json

{
  "extractedFields": [
    {
      "fieldName": "submitter_email",
      "value": "user@example.com",
      "confidence": 0.9
    }
  ],
  "validationRules": [
    {
      "fieldName": "submitter_email",
      "required": true,
      "type": "email"
    }
  ]
}
```

### RAG Question Answering

```http
POST /api/rag/answer
Content-Type: application/json

{
  "query": "What is the concentration of sample Sample-001?",
  "context": "Additional context...",
  "maxResults": 5,
  "threshold": 0.7
}
```

### Job Management

#### Get Job by ID
```http
GET /api/jobs/{jobId}
```

#### Get Jobs by Sample ID
```http
GET /api/jobs/sample/{sampleId}
```

#### Get All Jobs
```http
GET /api/jobs?limit=50&offset=0&status=completed&type=pdf_extraction
```

#### Get Job Statistics
```http
GET /api/jobs/stats
```

#### Get Service Statistics
```http
GET /api/stats
```

### Metrics

```http
GET /metrics
```

Returns Prometheus metrics including:
- `ai_processing_jobs_total`: Total processing jobs by status and type
- `ai_processing_job_duration_seconds`: Job processing duration
- `ai_processing_active_jobs`: Currently active jobs
- `ai_processing_errors_total`: Error counts by type

## Data Models

### ProcessingJob

```typescript
interface ProcessingJob {
  id: string
  sampleId?: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  processingType: ProcessingType
  status: ProcessingStatus
  progress: number
  result?: ProcessingResult
  error?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
}
```

### ExtractedField

```typescript
interface ExtractedField {
  fieldName: string
  value: string
  confidence: number
  confidenceLevel: ConfidenceLevel
  source: string
  pageNumber?: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  validationErrors?: string[]
}
```

### ProcessingResult

```typescript
interface ProcessingResult {
  extractedFields: ExtractedField[]
  confidence: number
  confidenceLevel: ConfidenceLevel
  processingTime: number
  pagesProcessed: number
  validationScore: number
  suggestions?: string[]
  warnings?: string[]
}
```

## Database Schema

### Tables

- `processing_jobs`: Job tracking and metadata
- `extracted_data`: Extracted field data
- `vector_embeddings`: Document embeddings for search
- `processing_templates`: Processing configuration templates
- `validation_rules`: Data validation rules

### Indexes

- `processing_jobs_status_idx`: Status-based queries
- `processing_jobs_sample_id_idx`: Sample-based queries
- `processing_jobs_created_at_idx`: Time-based queries
- `extracted_data_job_id_idx`: Job-based data queries
- `vector_embeddings_job_id_idx`: Vector storage queries

## Monitoring

### Health Checks

The service provides comprehensive health checks for:
- Database connectivity
- Ollama AI service
- Qdrant vector database
- PDF processing capabilities

### Metrics

Prometheus metrics are available at `/metrics`:
- Job processing rates and durations
- Error rates by type
- Active job counts
- Service health status

### Logging

Structured logging with Winston:
- Request/response logging
- Error tracking with stack traces
- Performance metrics
- Service health events

## Development

### Project Structure

```
src/
├── database/
│   ├── connection.ts    # Database connection and configuration
│   └── schema.ts        # Database schema and migrations
├── repositories/
│   └── ProcessingJobRepository.ts  # Data access layer
├── services/
│   ├── AIProcessingService.ts      # Main orchestration service
│   ├── PDFProcessingService.ts     # PDF text extraction
│   ├── AIService.ts               # LLM integration
│   └── VectorService.ts           # Vector database operations
├── types/
│   └── processing.ts              # TypeScript type definitions
└── index.ts                       # Express server and API endpoints
```

### Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  ai-processing:
    build: ./services/ai-processing
    ports:
      - "3003:3003"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/ai_processing_db
      - OLLAMA_URL=http://ollama:11434
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - postgres
      - ollama
      - qdrant
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ai_processing_db
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  ollama_data:
  qdrant_data:
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-processing-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-processing-service
  template:
    metadata:
      labels:
        app: ai-processing-service
    spec:
      containers:
      - name: ai-processing
        image: ai-processing-service:latest
        ports:
        - containerPort: 3003
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: OLLAMA_URL
          value: "http://ollama-service:11434"
        - name: QDRANT_URL
          value: "http://qdrant-service:6333"
        livenessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL or individual DB_* variables
   - Ensure PostgreSQL is running and accessible
   - Verify database exists and user has permissions

2. **Ollama Service Unavailable**
   - Check OLLAMA_URL is correct
   - Ensure Ollama is running and model is downloaded
   - Verify network connectivity

3. **Qdrant Service Unavailable**
   - Check QDRANT_URL is correct
   - Ensure Qdrant is running
   - Verify collection exists

4. **PDF Processing Fails**
   - Check file size limits
   - Verify PDF is not corrupted
   - Ensure sufficient memory for processing

### Logs

Check logs for detailed error information:
```bash
# Docker logs
docker logs ai-processing-service

# Kubernetes logs
kubectl logs deployment/ai-processing-service
```

### Performance Tuning

1. **Database Optimization**
   - Add appropriate indexes
   - Configure connection pooling
   - Monitor query performance

2. **AI Processing**
   - Use appropriate Ollama model size
   - Configure batch processing
   - Monitor memory usage

3. **Vector Search**
   - Optimize Qdrant collection settings
   - Configure appropriate index types
   - Monitor search performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.