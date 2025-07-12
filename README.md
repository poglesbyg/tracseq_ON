# TracSeq ON - AI-Driven Laboratory Management Platform

**TracSeq ON** is a comprehensive AI-powered laboratory information management system (LIMS) specialized for CRISPR gene editing and Oxford Nanopore sequencing workflows. Built with modern web technologies and integrated with Ollama AI, it provides intelligent analysis, automated form processing, and comprehensive experiment tracking.

## 🧬 Core Features

### **CRISPR Design Studio**
- **AI-Powered Guide RNA Design**: Intelligent sequence analysis with GC content optimization and efficiency scoring
- **Off-Target Analysis**: Comprehensive prediction and risk assessment for guide RNA safety
- **Batch Processing**: High-throughput analysis of multiple sequences simultaneously
- **3D Molecular Visualization**: Interactive molecular viewer for guide RNA structures
- **AI Chat Assistant**: Natural language interface for CRISPR methodology questions

### **Nanopore Sample Tracking**
- **Intelligent PDF Processing**: AI-powered extraction from submission forms with 50+ regex patterns
- **Sample Management**: Complete tracking from submission to completion
- **Flow Cell Optimization**: Automated recommendations for MinION/GridION/PromethION
- **Quality Control**: Automated validation and quality assessment
- **Bioinformatics Pipeline**: Integrated analysis workflow management

### **AI Integration**
- **Ollama LLM Integration**: Local AI models for sequence analysis and optimization
- **Fallback Systems**: Algorithmic analysis when AI is unavailable
- **RAG System**: Vector embeddings for enhanced document understanding
- **Confidence Scoring**: Quality assessment for all AI-generated results

## 🏗️ Architecture

### **Frontend (Astro + React)**
- **Modern UI**: Built with Tailwind CSS and shadcn/ui components
- **Server-Side Rendering**: Astro for optimal performance
- **Interactive Components**: React for dynamic user interfaces
- **Real-Time Updates**: Smart polling for live data synchronization

### **Backend (tRPC + Kysely)**
- **Type-Safe API**: End-to-end type safety with tRPC
- **Database Layer**: Kysely query builder with PostgreSQL
- **Authentication**: Better-auth with GitHub OAuth
- **Microservices**: Modular architecture for scalability

### **Database (PostgreSQL)**
- **CRISPR Schema**: Experiments, sequences, guide RNAs, off-target sites
- **Nanopore Schema**: Sample tracking, processing steps, quality metrics
- **User Management**: Lab-specific roles and permissions
- **Analysis Results**: Flexible JSONB storage for computational results

### **AI Services**
- **Ollama Integration**: Local LLM deployment for privacy
- **PDF Processing**: Intelligent document parsing and extraction
- **Sequence Analysis**: AI-powered DNA/RNA analysis
- **Guide Optimization**: Machine learning-enhanced design recommendations

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ and PNPM
- Docker and Docker Compose
- Ollama (optional, for AI features)

### **1. Clone and Install**
```bash
git clone https://github.com/your-org/tracseq-on.git
cd tracseq-on
pnpm install
```

### **2. Start Database**
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run database migrations
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db" pnpm --filter @app/db db:migrate

# Seed with sample data
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db" pnpm --filter @app/db db:seed
```

### **3. Configure Environment**
Create `.env` in `apps/web/`:
```env
# Database
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db"

# Authentication
AUTH_SECRET="your-secret-key-here"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI Services (optional)
OLLAMA_HOST="http://localhost:11434"
```

### **4. Start Development Server**
```bash
pnpm dev
```

**Access the application:**
- **Main App**: http://localhost:3005
- **CRISPR Studio**: http://localhost:3005/crispr
- **Nanopore Tracking**: http://localhost:3005/nanopore
- **Database Admin**: http://localhost:5050 (pgAdmin)

## 🤖 AI Setup (Optional)

### **Install Ollama**
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows - Download from https://ollama.ai
```

### **Download AI Models**
```bash
# Start Ollama service
ollama serve

# Download recommended models
ollama pull llama3.1        # General purpose
ollama pull llama3.1:8b     # Faster responses
ollama pull llama3.1:70b    # Highest quality
```

### **Test AI Integration**
```bash
# Test model availability
ollama run llama3.1 "What is CRISPR gene editing?"
```

## 📊 System Components

### **Applications**
- **`apps/web`**: Main Astro application with React components
- **`packages/api`**: tRPC API layer with domain-specific procedures
- **`packages/db`**: Database schemas, migrations, and utilities
- **`packages/utils`**: Shared utilities and helpers

### **Key Features by Domain**

#### **CRISPR Design (`/crispr`)**
- Guide RNA design with efficiency scoring
- Off-target analysis and risk assessment
- Batch processing for multiple sequences
- AI-powered optimization recommendations
- 3D molecular visualization
- Export capabilities (PDF, CSV, FASTA)

#### **Nanopore Tracking (`/nanopore`)**
- Sample submission and tracking
- PDF form processing with AI extraction
- Quality control and validation
- Flow cell management and optimization
- Bioinformatics pipeline integration
- Progress tracking and notifications

#### **AI Services**
- Local LLM integration with Ollama
- Intelligent sequence analysis
- PDF document processing
- Natural language chat interface
- Fallback algorithmic analysis
- Confidence scoring and validation

## 🔧 Development

### **Available Scripts**
```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build all packages
pnpm preview          # Preview production build

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # TypeScript checking
pnpm test             # Run tests
pnpm fix              # Auto-fix formatting and linting

# Database
pnpm --filter @app/db db:migrate     # Run migrations
pnpm --filter @app/db db:seed        # Seed database
pnpm --filter @app/db db:reset       # Reset database
```

### **Database Management**
```bash
# Create new migration
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db" pnpm --filter @app/db db:migrate:create <name>

# Run migrations
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db" pnpm --filter @app/db db:migrate

# Seed with sample data
DATABASE_URL="postgresql://crispr_user:crispr_password@localhost:5432/crispr_db" pnpm --filter @app/db db:seed
```

## 🏭 Production Deployment

### **Docker Deployment**
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with production settings
docker-compose -f docker-compose.prod.yml up -d
```

### **Environment Variables**
```env
# Production Database
DATABASE_URL="postgresql://user:password@host:5432/tracseq_production"

# Authentication
AUTH_SECRET="secure-production-secret"
GITHUB_CLIENT_ID="production-github-app-id"
GITHUB_CLIENT_SECRET="production-github-app-secret"

# AI Services
OLLAMA_HOST="https://your-ollama-instance.com"

# Performance
NODE_ENV="production"
LOG_LEVEL="info"
```

## 🧪 Testing

### **AI Features Demo**
Visit `/crispr` and try:
1. **Sequence Analysis**: Enter DNA sequence for AI analysis
2. **Guide Design**: Generate and optimize guide RNAs
3. **Chat Assistant**: Ask questions about CRISPR methodology
4. **PDF Processing**: Upload Nanopore submission forms

### **Sample Data**
The system includes realistic sample data:
- 6 CRISPR experiments with different organisms
- 15 Nanopore samples with various statuses
- Guide RNA designs with efficiency scores
- Off-target analysis results

## 📚 Documentation

### **API Documentation**
- **tRPC Endpoints**: Auto-generated type-safe API
- **Database Schema**: Comprehensive migration files
- **AI Services**: Ollama integration patterns

### **Developer Guidelines**
- **Code Conventions**: TypeScript best practices
- **Database Patterns**: Kysely type helpers
- **Component Architecture**: React + Astro patterns
- **AI Integration**: LLM service patterns

## 🔐 Security

### **Data Protection**
- **Local AI Processing**: No data sent to external AI services
- **User Authentication**: GitHub OAuth with session management
- **Database Security**: Parameterized queries and validation
- **Input Sanitization**: Comprehensive validation schemas

### **Privacy Features**
- **On-Premises AI**: Ollama runs locally for data privacy
- **Secure Sessions**: Better-auth with secure cookie handling
- **Access Control**: Lab-specific permissions and roles
- **Audit Logging**: Comprehensive activity tracking

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Follow the coding conventions
4. Add tests for new features
5. Submit a pull request

### **Code Style**
- **TypeScript**: Strict type checking
- **ESLint**: Configured with best practices
- **Prettier**: Consistent code formatting
- **Commit Messages**: Conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ollama**: Local LLM infrastructure
- **shadcn/ui**: Beautiful UI components
- **tRPC**: Type-safe API development
- **Kysely**: Type-safe SQL query builder
- **Astro**: Modern web framework

---

**TracSeq ON** - Empowering laboratory research with AI-driven analysis and comprehensive experiment management.

*Context improved by Giga AI*
