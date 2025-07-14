# Nanopore Tracking App

A standalone application for tracking nanopore sequencing samples, separated from the main monorepo.

## Features

- Sample submission and tracking
- Processing workflow management
- AI-powered analysis and assistance
- PDF document handling
- Export capabilities
- Real-time status updates

## Technology Stack

- **Frontend**: Astro + React + TypeScript
- **Backend**: tRPC + Node.js
- **Database**: PostgreSQL
- **AI**: Ollama integration
- **Styling**: Tailwind CSS
- **Deployment**: OpenShift ready

## Development

### Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL database
- Ollama (for AI features)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3001`

## Deployment

### OpenShift Deployment

1. Login to OpenShift:
   ```bash
   oc login
   ```

2. Create a new project (optional):
   ```bash
   oc new-project nanopore-tracking
   ```

3. Update the secret with your database URL:
   ```bash
   # Edit deployment/openshift/secret.yaml with your base64 encoded DATABASE_URL
   ```

4. Deploy the application:
   ```bash
   ./deployment/deploy.sh
   ```

### Docker Deployment

1. Build and run with Docker Compose:
   ```bash
   cd deployment/docker
   docker-compose up -d
   ```

## Configuration

Environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OLLAMA_HOST`: Ollama service URL
- `NODE_ENV`: Environment (development/production)

## API Endpoints

The application provides tRPC endpoints for:
- Sample management
- Processing steps
- File attachments
- Data export

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.