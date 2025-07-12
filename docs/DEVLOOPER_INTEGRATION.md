# Devlooper Integration for TracSeq ON

This document explains how to use [Modal Labs' devlooper](https://github.com/modal-labs/devlooper) with your TracSeq ON project for automated code generation.

## 🤖 What is devlooper?

Devlooper is a program synthesis agent that:

- **Generates code from natural language prompts**
- **Automatically fixes bugs by running tests**
- **Iterates until all tests pass**
- **Supports Python, React, and Rust**
- **Runs in isolated Modal sandboxes**

## 🚀 Quick Start

### 1. Setup devlooper

```bash
# Install and configure devlooper
pnpm devlooper:setup

# This will:
# - Install Modal CLI
# - Set up authentication (you'll need to run: modal token new)
# - Clone devlooper repository
# - Install dependencies
```

### 2. Set up OpenAI API Key (Required)

Devlooper uses OpenAI's GPT models, so you need to provide an API key:

1. **Get an OpenAI API Key:**
   - Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-...`)

2. **Add it to Modal Secrets:**
   ```bash
   # Go to the Modal secrets page (link provided when you run devlooper)
   # Or create it manually:
   modal secret create openai-secret OPENAI_API_KEY=sk-your-api-key-here
   ```

   Alternatively, visit: https://modal.com/secrets/create and create a secret named `openai-secret` with key `OPENAI_API_KEY`

### 3. Generate Code

```bash
# Generate CRISPR analysis code
pnpm devlooper crispr "A guide RNA efficiency predictor"

# Generate React components
pnpm devlooper react "A DNA sequence input component"

# Generate bioinformatics utilities
pnpm devlooper bio "A FASTQ file parser"

# Run all predefined prompts for TracSeq ON
pnpm devlooper:presets
```

## 🧬 Use Cases for TracSeq ON

### CRISPR Analysis Algorithms

**Perfect for generating:**

- Guide RNA scoring algorithms
- Off-target prediction models
- PAM site detection algorithms
- Sequence optimization tools

**Example:**

```bash
./scripts/devlooper-integration.sh crispr "A Python class that calculates CRISPR guide RNA efficiency scores using machine learning models, with methods for batch processing and confidence intervals"
```

### Nanopore Data Processing

**Perfect for generating:**

- FAST5 file processors
- Quality analysis tools
- Signal processing algorithms
- Data format converters

**Example:**

```bash
./scripts/devlooper-integration.sh bio "A Python module for processing Oxford Nanopore FAST5 files with quality filtering and statistics generation"
```

### React Components

**Perfect for generating:**

- Sequence visualization components
- Data table components
- File upload interfaces
- Analysis result displays

**Example:**

```bash
./scripts/devlooper-integration.sh react "A React component for displaying DNA sequences with PAM site highlighting and GC content visualization"
```

## 📋 Predefined Prompts

The system includes carefully crafted prompts for common TracSeq ON needs:

### CRISPR Analysis

1. **Guide RNA Scorer** - ML-based efficiency prediction
2. **Sequence Analyzer** - Cut site identification and validation
3. **Off-target Predictor** - Genome-wide off-target analysis

### Nanopore Analysis

1. **FAST5 Processor** - File parsing and signal extraction
2. **Quality Analyzer** - Read quality and statistics

### React Components

1. **Sequence Viewer** - DNA visualization with annotations
2. **Results Table** - Sortable, filterable analysis results
3. **File Upload** - Drag-and-drop bioinformatics file upload

### Utilities

1. **Bioinformatics Utils** - Common sequence operations
2. **Data Validators** - Quality control and validation

## 🛠️ Configuration

The `devlooper.config.json` file contains all predefined prompts and configurations:

```json
{
  "prompts": {
    "crispr_analysis": [...],
    "nanopore_analysis": [...],
    "react_components": [...],
    "utilities": [...]
  },
  "workflows": [
    "crispr_pipeline",
    "nanopore_pipeline",
    "ui_components"
  ]
}
```

## 🔄 Workflow Integration

### 1. Development Workflow

```bash
# Morning: Generate new components
pnpm devlooper:presets

# Review generated code in generated/ directory
ls -la generated/

# Move promising code to your project
cp generated/crispr/guide_rna_scorer.py apps/web/src/lib/crispr/

# Test and integrate
pnpm dev-loop:check
```

### 2. Feature Development

```bash
# Need a new CRISPR algorithm?
pnpm devlooper crispr "A machine learning model for predicting CRISPR knockout efficiency in different cell types"

# Need a new UI component?
pnpm devlooper react "A component for visualizing CRISPR off-target sites on a genome browser"

# Need data processing?
pnpm devlooper bio "A pipeline for processing multiplexed Nanopore sequencing data"
```

### 3. Testing Integration

Generated code comes with comprehensive tests:

```bash
# Run tests for generated code
cd generated/crispr
python -m pytest guide_rna_scorer_test.py

# For React components
cd generated/react
npm test sequence_viewer.test.tsx
```

## 📁 Output Structure

Generated code is organized in the `generated/` directory:

```
generated/
├── crispr/
│   ├── guide_rna_scorer.py
│   ├── guide_rna_scorer_test.py
│   ├── sequence_analyzer.py
│   └── sequence_analyzer_test.py
├── nanopore/
│   ├── fast5_processor.py
│   ├── fast5_processor_test.py
│   ├── quality_analyzer.py
│   └── quality_analyzer_test.py
├── react/
│   ├── sequence_viewer.tsx
│   ├── sequence_viewer.test.tsx
│   ├── results_table.tsx
│   └── results_table.test.tsx
└── utils/
    ├── bioinformatics_utils.py
    ├── bioinformatics_utils_test.py
    ├── data_validators.py
    └── data_validators_test.py
```

## 🎯 Best Practices

### 1. Prompt Engineering

**Good prompts:**

- Specify exact requirements and constraints
- Include testing requirements
- Mention specific libraries or frameworks
- Provide context about the domain (CRISPR, Nanopore, etc.)

**Example:**

```bash
pnpm devlooper crispr "Create a Python class for CRISPR guide RNA scoring that uses scikit-learn for machine learning models, includes methods for batch processing, handles edge cases like low-complexity sequences, and provides confidence intervals for all predictions. Include comprehensive unit tests using pytest."
```

### 2. Code Review

Always review generated code before integration:

1. **Check algorithms** - Verify biological accuracy
2. **Review tests** - Ensure comprehensive coverage
3. **Validate dependencies** - Check compatibility
4. **Test integration** - Verify it works with your system

### 3. Iterative Development

Use devlooper for rapid prototyping:

1. Generate initial implementation
2. Test and identify issues
3. Refine prompts based on results
4. Regenerate with improvements
5. Integrate successful components

## 🔧 Advanced Usage

### Custom Prompts

Create your own prompts for specific needs:

```bash
./scripts/devlooper-integration.sh crispr "A Python class for analyzing CRISPR base editing efficiency that accounts for target sequence context, guide RNA structure, and cellular factors. Should integrate with existing TracSeq ON database schemas and provide REST API endpoints."
```

### Batch Generation

Generate multiple related components:

```bash
# Generate a complete analysis pipeline
for component in "sequence_validator" "efficiency_predictor" "result_formatter"; do
  pnpm devlooper crispr "A $component for CRISPR analysis pipeline"
done
```

### Integration with Existing Code

Generated code can be integrated with your existing services:

```python
# Example integration
from generated.crispr.guide_rna_scorer import GuideRNAScorer
from apps.web.src.services.crispr_service import CrisprService

class EnhancedCrisprService(CrisprService):
    def __init__(self):
        super().__init__()
        self.scorer = GuideRNAScorer()

    def analyze_guides(self, sequences):
        # Use generated scorer with existing service
        scores = self.scorer.predict_efficiency(sequences)
        return self.format_results(scores)
```

## 🚨 Troubleshooting

### Modal Authentication

```bash
# If you get authentication errors
modal token new
modal token set-default <your-token>
```

### Generation Failures

```bash
# Check Modal logs
modal logs

# Retry with simpler prompt
pnpm devlooper crispr "A simple guide RNA scorer"
```

### Test Failures

Generated code might fail tests initially. This is normal - devlooper will iterate to fix issues.

## 💡 Tips for Success

1. **Start simple** - Begin with basic functionality, then add complexity
2. **Be specific** - Include exact requirements and constraints
3. **Test thoroughly** - Generated code needs validation for biological accuracy
4. **Iterate quickly** - Use devlooper for rapid prototyping
5. **Review carefully** - Always review generated code before production use

## 🔗 Integration with Development Loop

Combine devlooper with your existing development workflow:

```bash
# Generate code
pnpm devlooper:presets

# Test and check quality
pnpm dev-loop:check

# Run full test suite
pnpm dev-loop:test --e2e

# Clean up if needed
pnpm dev-loop:clean
```

This integration makes devlooper a powerful tool for accelerating your TracSeq ON development while maintaining code quality and test coverage.
