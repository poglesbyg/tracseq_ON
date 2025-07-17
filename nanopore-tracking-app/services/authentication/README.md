# Authentication Service

A microservice for handling user authentication, session management, and authorization in the Nanopore Tracking Application.

## Features

- **User Management**: Registration, profile updates, account deletion
- **Authentication**: JWT-based login/logout with session management
- **Authorization**: Role-based access control (admin, staff, user)
- **Security**: Password hashing, rate limiting, audit logging
- **Password Reset**: Secure password reset flow with email tokens
- **Session Management**: JWT tokens with refresh capabilities
- **Audit Trail**: Comprehensive logging of user actions
- **Rate Limiting**: Protection against brute force attacks

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│  Auth Service   │───▶│  Auth Database  │
│   (Port 3001)   │    │   (Port 3004)   │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technology Stack

- **Runtime**: Node.js 20 with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Kysely ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Validation**: Zod schema validation
- **Security**: Helmet, CORS, rate limiting
- **Monitoring**: Health checks, request logging
- **Containerization**: Docker with multi-stage builds

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker (optional)

### Local Development

1. **Clone and navigate to the service directory**:
   ```bash
   cd services/authentication
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**:
   ```bash
   # Create database and run migrations
   pnpm run db:migrate
   ```

5. **Start the development server**:
   ```bash
   pnpm run dev
   ```

The service will be available at `http://localhost:3004`

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t authentication-service .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3004:3004 \
     -e DATABASE_URL=postgresql://user:pass@host:5432/auth_db \
     -e JWT_SECRET=your-secret-key \
     authentication-service
   ```

## API Endpoints

### Authentication

#### POST `/auth/login`
Authenticate a user and return JWT token.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-01T00:00:00Z"
    },
    "session": {
      "id": "uuid",
      "userId": "uuid",
      "token": "jwt-token",
      "expiresAt": "2024-01-08T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T00:00:00Z"
    },
    "token": "jwt-token"
  },
  "message": "Login successful"
}
```

#### POST `/auth/logout`
Logout the current user (requires authentication).

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### POST `/auth/refresh`
Refresh a session token.

**Request**:
```json
{
  "sessionId": "session-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "token": "new-jwt-token",
    "expiresAt": "2024-01-08T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastActivityAt": "2024-01-01T00:00:00Z"
  },
  "message": "Session refreshed successfully"
}
```

### User Management

#### POST `/auth/register`
Register a new user.

**Request**:
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "password123",
  "role": "user"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "user",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  },
  "message": "User created successfully"
}
```

#### GET `/auth/me`
Get current user information (requires authentication).

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT `/auth/me`
Update current user profile (requires authentication).

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "name": "Updated Name",
  "role": "staff"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Updated Name",
    "role": "staff",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-01T00:00:00Z"
  },
  "message": "User updated successfully"
}
```

### Password Management

#### POST `/auth/change-password`
Change user password (requires authentication).

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### POST `/auth/forgot-password`
Request password reset token.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "reset-token-uuid"
  },
  "message": "Password reset token generated. Check your email for instructions."
}
```

#### POST `/auth/reset-password`
Reset password using token.

**Request**:
```json
{
  "token": "reset-token-uuid",
  "newPassword": "newpassword123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Admin Endpoints

#### GET `/auth/users`
Get list of users (admin only).

**Headers**: `Authorization: Bearer <admin-token>`

#### DELETE `/auth/users/:id`
Delete a user (admin only).

**Headers**: `Authorization: Bearer <admin-token>`

#### POST `/auth/logout-all`
Logout all sessions for current user (staff/admin only).

**Headers**: `Authorization: Bearer <token>`

### System Endpoints

#### GET `/health`
Health check endpoint.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "service": "authentication",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

#### GET `/discovery`
Service discovery endpoint.

**Response**:
```json
{
  "service": "authentication",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "auth": "/auth/*",
    "discovery": "/discovery"
  },
  "capabilities": [
    "user_management",
    "session_management",
    "jwt_authentication",
    "password_reset",
    "rate_limiting",
    "audit_logging"
  ]
}
```

## Data Models

### User
```typescript
interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}
```

### Session
```typescript
interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
  lastActivityAt: Date
  userAgent?: string
  ipAddress?: string
}
```

### AuthSession
```typescript
interface AuthSession {
  userId: string
  email: string
  name: string
  role: string
  expiresAt: Date
}
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Service port | `3004` | No |
| `NODE_ENV` | Environment | `development` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT token expiry | `15m` | No |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiry | `7d` | No |
| `PASSWORD_RESET_EXPIRES_IN` | Password reset token expiry | `1h` | No |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts | `5` | No |
| `LOCKOUT_DURATION` | Account lockout duration (minutes) | `15` | No |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3001` | No |

## Database Schema

The service uses the following PostgreSQL tables:

- `users` - User accounts and profiles
- `sessions` - Active user sessions
- `password_resets` - Password reset tokens
- `login_attempts` - Login attempt tracking
- `user_audit_log` - User action audit trail

See `src/database/schema.sql` for complete schema definition.

## Security Features

### Password Security
- Bcrypt hashing with 12 salt rounds
- Minimum 8 character password requirement
- Secure password reset flow

### Rate Limiting
- 5 failed login attempts per 15 minutes
- Account lockout after max attempts
- IP-based rate limiting

### JWT Security
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Secure token storage

### Audit Logging
- All user actions logged
- IP address and user agent tracking
- 90-day retention policy

## Monitoring

### Health Checks
- Database connectivity
- Service status
- Response time monitoring

### Logging
- Request/response logging
- Error tracking
- Performance metrics

### Metrics
- Login success/failure rates
- Session management stats
- User activity tracking

## Development

### Scripts
```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Build for production
pnpm run start        # Start production server

# Testing
pnpm run test         # Run tests
pnpm run test:watch   # Run tests in watch mode

# Database
pnpm run db:migrate   # Run database migrations
pnpm run db:seed      # Seed database with test data

# Linting
pnpm run lint         # Run ESLint
pnpm run lint:fix     # Fix linting issues
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test auth-service.test.ts
```

## Deployment

### Docker Compose
The service is included in the main `docker-compose.microservices.yml` file:

```yaml
authentication:
  build:
    context: ../..
    dockerfile: deployment/docker/Dockerfile.auth-service
  ports:
    - "3004:3004"
  environment:
    - NODE_ENV=development
    - PORT=3004
    - DATABASE_URL=postgresql://postgres:password@auth-db:5432/auth_db
    - JWT_SECRET=your-jwt-secret-key
  depends_on:
    - auth-db
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authentication-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: authentication-service
  template:
    metadata:
      labels:
        app: authentication-service
    spec:
      containers:
      - name: authentication-service
        image: authentication-service:latest
        ports:
        - containerPort: 3004
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-secret
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` environment variable
   - Verify PostgreSQL is running
   - Check network connectivity

2. **JWT Token Invalid**
   - Verify `JWT_SECRET` is set correctly
   - Check token expiration
   - Ensure proper Authorization header format

3. **Rate Limiting**
   - Wait for lockout period to expire
   - Check login attempt logs
   - Verify IP address detection

4. **CORS Errors**
   - Update `CORS_ORIGIN` environment variable
   - Check frontend origin configuration
   - Verify preflight request handling

### Logs
```bash
# View service logs
docker logs authentication-service

# View database logs
docker logs auth-db

# Check health endpoint
curl http://localhost:3004/health
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Ensure security best practices
5. Run linting and tests before committing

## License

This project is licensed under the MIT License.