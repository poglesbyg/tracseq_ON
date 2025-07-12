# 🤖 Devlooper Integration - Quick Start

[Modal Labs' devlooper](https://github.com/modal-labs/devlooper) is now integrated with TracSeq ON for AI-powered code generation!

## 🚀 Quick Setup

```bash
# 1. Set up devlooper (one-time setup)
pnpm devlooper:setup

# 2. You'll need to authenticate with Modal
modal token new

# 3. Set up OpenAI API Key (Required)
# Get your API key from: https://platform.openai.com/api-keys
modal secret create openai-secret OPENAI_API_KEY=sk-your-api-key-here

# 4. Generate code for your project
pnpm devlooper:presets
```

## 🧬 What Can You Generate?

### CRISPR Analysis Code

```bash
pnpm devlooper crispr "A guide RNA efficiency predictor with machine learning"
```

### React Components

```bash
pnpm devlooper react "A DNA sequence viewer with PAM site highlighting"
```

### Bioinformatics Utilities

```bash
pnpm devlooper bio "A FAST5 file processor for Oxford Nanopore data"
```

## 🎯 Perfect for TracSeq ON

Devlooper is especially powerful for:

- **CRISPR algorithms** - Guide RNA scoring, off-target prediction
- **Nanopore analysis** - FAST5 processing, quality analysis
- **React components** - Sequence visualization, data tables
- **Bioinformatics utilities** - File parsers, data validators

## 🔄 Workflow Integration

```bash
# Generate code
pnpm devlooper:presets

# Review generated code
ls -la generated/

# Test and integrate
pnpm dev-loop:check

# Move to your project
cp generated/crispr/guide_rna_scorer.py apps/web/src/lib/crispr/
```

## 📚 Learn More

- [Full Documentation](docs/DEVLOOPER_INTEGRATION.md)
- [Configuration File](devlooper.config.json)
- [Modal Labs devlooper](https://github.com/modal-labs/devlooper)

## 🎨 Example Outputs

Devlooper generates production-ready code with:

- ✅ Comprehensive unit tests
- ✅ Type hints and documentation
- ✅ Error handling
- ✅ Best practices

All code is automatically tested and iterated until it passes all tests!
