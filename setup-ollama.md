# Ollama AI Setup for CRISPR Design Studio

This guide will help you set up Ollama to enable the AI-powered features in the CRISPR Design Studio.

## Installation

### macOS
```bash
# Install Ollama
brew install ollama

# Or download from https://ollama.ai
```

### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Windows
Download the installer from https://ollama.ai

## Setup

1. **Start Ollama service:**
```bash
ollama serve
```

2. **Download a recommended model:**
```bash
# For general CRISPR assistance (recommended)
ollama pull llama3.1

# For more advanced analysis (larger model)
ollama pull llama3.1:70b

# For faster responses (smaller model)
ollama pull llama3.1:8b
```

3. **Test the installation:**
```bash
ollama run llama3.1 "What is CRISPR?"
```

## AI Features Available

### 🧬 AI Sequence Analysis
- Intelligent DNA sequence evaluation
- GC content optimization suggestions
- Potential challenge identification
- Risk factor assessment

### ⚡ AI Guide Optimization
- Guide RNA efficiency enhancement
- Secondary structure prediction
- Off-target risk evaluation
- Sequence modification suggestions

### 🤖 AI Chat Assistant
- Natural language CRISPR questions
- Experimental design guidance
- Troubleshooting support
- Best practices recommendations

### 🎯 Smart Experiment Suggestions
- Innovative experimental approaches
- Protocol optimization
- Literature-based recommendations
- Risk mitigation strategies

## Configuration

The AI service will automatically detect if Ollama is running and fall back to algorithmic analysis if not available.

### Model Selection
You can change the AI model in the browser console:
```javascript
// Switch to a different model
aiService.setModel('llama3.1:70b')
```

### Fallback Mode
If Ollama is not available, the system will:
- Use algorithmic sequence analysis
- Provide rule-based recommendations
- Display helpful fallback messages
- Continue to function without AI features

## Troubleshooting

### Ollama Not Detected
1. Ensure Ollama is running: `ollama serve`
2. Check the service is accessible: `curl http://localhost:11434`
3. Verify model is downloaded: `ollama list`

### Performance Issues
1. Use smaller models for faster responses: `llama3.1:8b`
2. Ensure sufficient RAM (8GB+ recommended)
3. Close other applications if needed

### Model Errors
1. Re-download the model: `ollama pull llama3.1`
2. Try a different model: `ollama pull mistral`
3. Check Ollama logs for errors

## Advanced Configuration

### Custom Models
You can use specialized biology/chemistry models if available:
```bash
ollama pull biollama  # Example custom model
```

### API Configuration
The default Ollama endpoint is `http://localhost:11434`. If running on a different host:
```javascript
// In browser console
aiService.setHost('http://your-ollama-server:11434')
```

### Performance Tuning
For better performance, configure Ollama with:
```bash
# Set GPU layers (if you have a GPU)
OLLAMA_NUM_GPU_LAYERS=35 ollama serve

# Increase context size
OLLAMA_NUM_CTX=4096 ollama serve
```

## Getting Help

- **Ollama Documentation**: https://ollama.ai/docs
- **Model Library**: https://ollama.ai/library
- **Community**: https://github.com/ollama/ollama

The AI features are designed to enhance your CRISPR workflow while maintaining full functionality even without AI capabilities. 