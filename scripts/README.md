# TracSeq ON Development Loop Automation

This directory contains automation scripts to streamline your development workflow.

## 🚀 Quick Start

```bash
# Start everything (recommended for daily development)
pnpm dev-loop

# Or run the script directly
./scripts/dev-loop.sh start
```

## 🛠️ Available Commands

### Development Workflow

```bash
# Start complete development environment
./scripts/dev-loop.sh start
# - Starts Ollama service (fixes the 404 errors you were seeing)
# - Starts PostgreSQL
# - Installs dependencies
# - Runs database migrations
# - Type checks code
# - Lints and auto-fixes issues
# - Starts development server

# Quick code quality check
./scripts/dev-loop.sh check
# - Type checking
# - Linting with auto-fix

# Run tests
./scripts/dev-loop.sh test
./scripts/dev-loop.sh test --e2e  # Include E2E tests
```

### Service Management

```bash
# Fix Ollama service (solves your current issue)
./scripts/dev-loop.sh ollama

# Database setup
./scripts/dev-loop.sh db
```

### Maintenance

```bash
# Clean build artifacts
./scripts/dev-loop.sh clean

# Deep clean (removes node_modules)
./scripts/dev-loop.sh clean --deep
```

## 🔧 VS Code Integration

The script is integrated with VS Code tasks. Access via:

1. **Command Palette** (`Cmd+Shift+P`)
2. Type "Tasks: Run Task"
3. Select any "Dev Loop" task

**Available VS Code Tasks:**

- `Dev Loop: Start Development Environment` (default build task - `Cmd+Shift+P` → "Tasks: Run Build Task")
- `Dev Loop: Quick Check`
- `Dev Loop: Run Tests`
- `Dev Loop: Run E2E Tests`
- `Dev Loop: Fix Ollama`
- `Dev Loop: Database Migration`
- `Dev Loop: Clean Build`
- `Dev Loop: Deep Clean`

## 🐛 Troubleshooting

### Ollama Issues (Your Current Problem)

The script automatically fixes the Ollama API issues you're experiencing:

```bash
# This will fix the "No working models found via API" error
./scripts/dev-loop.sh ollama
```

**What it does:**

1. Checks if Ollama is running on port 11434
2. Starts the service if needed
3. Tests model availability
4. Loads a default model if API shows empty models list
5. Ensures models are accessible via API

### PostgreSQL Issues

```bash
# Start PostgreSQL and run migrations
./scripts/dev-loop.sh db
```

### Port Conflicts

The script automatically handles port conflicts and will find available ports.

### Dependency Issues

```bash
# Clean and reinstall everything
./scripts/dev-loop.sh clean --deep
./scripts/dev-loop.sh start
```

## 📋 NPM Scripts

For convenience, these are also available as npm scripts:

```bash
pnpm dev-loop           # Full start
pnpm dev-loop:check     # Quick check
pnpm dev-loop:test      # Run tests
pnpm dev-loop:clean     # Clean build
```

## 🎯 What This Solves

**Your Current Issues:**

- ✅ Ollama service not responding (404 errors)
- ✅ Models not available via API
- ✅ Development server startup complexity
- ✅ Manual service management

**Development Workflow:**

- ✅ One-command development setup
- ✅ Automatic dependency management
- ✅ Integrated testing workflow
- ✅ Code quality checks
- ✅ Service health monitoring

## 🔄 Daily Workflow

**Morning Setup:**

```bash
pnpm dev-loop  # Starts everything you need
```

**Before Committing:**

```bash
pnpm dev-loop:check  # Quick quality check
```

**Before Pushing:**

```bash
pnpm dev-loop:test --e2e  # Full test suite
```

**Weekly Maintenance:**

```bash
pnpm dev-loop:clean  # Clean build artifacts
```

## 🚨 Emergency Commands

**Something's broken:**

```bash
./scripts/dev-loop.sh clean --deep  # Nuclear option
./scripts/dev-loop.sh start         # Fresh start
```

**Ollama not working:**

```bash
./scripts/dev-loop.sh ollama  # Fixes most Ollama issues
```

**Database issues:**

```bash
./scripts/dev-loop.sh db  # Restarts PostgreSQL and runs migrations
```

This automation system eliminates the manual setup steps and service management that was causing your Ollama issues, making your development workflow much smoother!
