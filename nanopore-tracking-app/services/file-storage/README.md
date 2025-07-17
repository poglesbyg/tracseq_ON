# File Storage Service

A microservice for handling file uploads, downloads, and processing in the Nanopore Tracking Application.

## Features

- **File Upload/Download**: Secure file storage with access control
- **File Processing**: Image resizing, PDF text extraction, metadata extraction
- **Search & Filtering**: Advanced file search with multiple criteria
- **Access Control**: Public/private file access with user authentication
- **Storage Statistics**: Monitoring and analytics for file storage
- **Rate Limiting**: Protection against abuse
- **Health Monitoring**: Built-in health checks and monitoring

## Architecture

```
File Storage Service
├── API Layer (Express.js)
├── Business Logic (FileStorageService)
├── Data Access (Kysely ORM)
├── File System Storage
└── PostgreSQL Database
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL with Kysely ORM
- **File Processing**: Sharp (images), pdf-parse (PDFs)
- **Authentication**: JWT-based auth middleware
- **Monitoring**: Winston logging, health checks
- **Containerization**: Docker with multi-stage builds

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional)

### Local Development

1. **Clone and install dependencies**:
   ```bash
   cd services/file-storage
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:
   ```bash
   # Create database
   createdb file_storage
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start the service**:
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:3004`

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t file-storage-service .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name file-storage \
     -p 3004:3004 \
     -v file-storage-data:/app/storage \
     -e FILE_STORAGE_DB_HOST=your-db-host \
     -e FILE_STORAGE_DB_NAME=file_storage \
     -e FILE_STORAGE_DB_USER=postgres \
     -e FILE_STORAGE_DB_PASSWORD=your-password \
     file-storage-service
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FILE_STORAGE_PORT` | `3004` | Service port |
| `FILE_STORAGE_DB_HOST` | `localhost` | Database host |
| `FILE_STORAGE_DB_PORT` | `5432` | Database port |
| `FILE_STORAGE_DB_NAME` | `file_storage` | Database name |
| `FILE_STORAGE_DB_USER` | `postgres` | Database user |
| `FILE_STORAGE_DB_PASSWORD` | `password` | Database password |
| `FILE_STORAGE_PATH` | `./storage/files` | File storage path |
| `FILE_STORAGE_MAX_SIZE` | `104857600` | Max file size (100MB) |
| `FILE_STORAGE_ALLOWED_TYPES` | `pdf,jpg,jpeg,png,gif,txt,csv,xlsx,docx` | Allowed file types |
| `FILE_STORAGE_CORS_ORIGIN` | `*` | CORS origin |
| `NODE_ENV` | `development` | Environment |

### File Storage Configuration

The service supports various file types and processing capabilities:

- **Supported Formats**: PDF, Images (JPG, PNG, GIF), Text files, Office documents
- **Image Processing**: Resize, compress, format conversion
- **PDF Processing**: Text extraction, metadata extraction
- **Storage**: Local file system with database metadata

## API Reference

### Authentication

Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### File Operations

#### Upload File
```http
POST /api/files/upload
Content-Type: multipart/form-data

file: <file>
description: "Sample description"
isPublic: false
tags: ["sample", "test"]
```

#### Download File
```http
GET /api/files/{fileId}/download
```

#### Get File Metadata
```http
GET /api/files/{fileId}
```

#### Update File Metadata
```http
PUT /api/files/{fileId}
Content-Type: application/json

{
  "description": "Updated description",
  "isPublic": true,
  "tags": ["updated", "tags"]
}
```

#### Delete File
```http
DELETE /api/files/{fileId}
```

### Search & Filtering

#### Search Files
```http
GET /api/files/search?fileType=pdf&uploadedBy=user123&isPublic=true&page=1&limit=20
```

**Query Parameters**:
- `fileType`: Filter by file type
- `uploadedBy`: Filter by uploader
- `isPublic`: Filter by public/private status
- `tags`: Comma-separated tags
- `dateFrom`: Start date (ISO 8601)
- `dateTo`: End date (ISO 8601)
- `minSize`: Minimum file size in bytes
- `maxSize`: Maximum file size in bytes
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### File Processing

#### Process Image
```http
POST /api/files/{fileId}/process/image
Content-Type: application/json

{
  "width": 800,
  "height": 600,
  "quality": 85,
  "format": "jpeg"
}
```

#### Process PDF
```http
POST /api/files/{fileId}/process/pdf
Content-Type: application/json

{
  "extractText": true,
  "extractMetadata": true
}
```

### Monitoring & Statistics

#### Get Storage Statistics
```http
GET /api/files/stats
```

#### Get Processing Capabilities
```http
GET /api/files/capabilities
```

#### Health Check
```http
GET /health
```

#### Service Discovery
```http
GET /discovery
```

## Data Models

### File Metadata
```typescript
interface FileMetadata {
  id: string
  originalName: string
  fileName: string
  fileType: string
  mimeType: string
  sizeBytes: number
  filePath: string
  description?: string
  uploadedBy?: string
  uploadedAt: Date
  updatedAt: Date
  isPublic: boolean
  tags?: string[]
  metadata?: Record<string, any>
}
```

### Upload Result
```typescript
interface UploadResult {
  file: FileMetadata
  filePath: string
  url: string
}
```

### Search Result
```typescript
interface FileSearchResult {
  files: FileMetadata[]
  total: number
  page: number
  limit: number
  totalPages: number
}
```

## Database Schema

### Files Table
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    description TEXT,
    uploaded_by VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    tags TEXT[],
    metadata JSONB,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### File Access Log
```sql
CREATE TABLE file_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    action VARCHAR(20) NOT NULL CHECK (action IN ('download', 'upload', 'delete', 'view')),
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Security Features

- **File Type Validation**: Whitelist of allowed file types
- **File Size Limits**: Configurable maximum file size
- **Access Control**: Public/private file access
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Request validation with express-validator
- **CORS Protection**: Configurable CORS policies
- **Security Headers**: Helmet.js security middleware

## Monitoring & Logging

### Log Levels
- `error`: Application errors
- `warn`: Warning messages
- `info`: General information
- `http`: HTTP request logs
- `debug`: Debug information (development only)

### Health Checks
- Database connectivity
- File system access
- Service responsiveness

### Metrics
- File upload/download counts
- Storage usage statistics
- Processing performance metrics
- Error rates and response times

## Development

### Project Structure
```
src/
├── database/
│   ├── connection.ts
│   └── schema.sql
├── middleware/
│   └── auth.ts
├── routes/
│   └── files.ts
├── services/
│   └── FileStorageService.ts
├── types/
│   └── index.ts
├── utils/
│   └── logger.ts
└── server.ts
```

### Available Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm test`: Run tests
- `npm run lint`: Run ESLint
- `npm run db:migrate`: Run database migrations

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  file-storage:
    build: ./services/file-storage
    ports:
      - "3004:3004"
    environment:
      - FILE_STORAGE_DB_HOST=postgres
      - FILE_STORAGE_DB_NAME=file_storage
      - FILE_STORAGE_DB_USER=postgres
      - FILE_STORAGE_DB_PASSWORD=password
    volumes:
      - file-storage-data:/app/storage
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=file_storage
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: file-storage
spec:
  replicas: 2
  selector:
    matchLabels:
      app: file-storage
  template:
    metadata:
      labels:
        app: file-storage
    spec:
      containers:
      - name: file-storage
        image: file-storage-service:latest
        ports:
        - containerPort: 3004
        env:
        - name: FILE_STORAGE_DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: host
        volumeMounts:
        - name: storage
          mountPath: /app/storage
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: file-storage-pvc
```

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size limits
   - Verify allowed file types
   - Ensure storage directory permissions

2. **Database Connection Issues**
   - Verify database credentials
   - Check network connectivity
   - Ensure database is running

3. **Permission Denied**
   - Check file ownership
   - Verify storage directory permissions
   - Ensure proper user authentication

### Logs
Logs are stored in `/app/logs/` with daily rotation:
- `file-storage-YYYY-MM-DD.log`: General logs
- `file-storage-error-YYYY-MM-DD.log`: Error logs only

### Health Check
Monitor service health at `/health` endpoint:
```bash
curl http://localhost:3004/health
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.