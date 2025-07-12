#!/bin/bash

# TracSeq ON - Devlooper Integration Script
# This script helps integrate Modal Labs' devlooper for automated code generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[DEVLOOPER]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Modal is installed
check_modal() {
    if ! command -v modal >/dev/null 2>&1; then
        print_error "Modal CLI not found. Installing..."
        pip install modal
    fi
    
    print_success "Modal CLI is available"
}

# Setup Modal token
setup_modal_token() {
    print_status "Setting up Modal token..."
    
    # Check if token exists by checking the config file
    if [ ! -f "$HOME/.modal.toml" ]; then
        print_warning "No Modal token found. Please run: modal token new"
        return 1
    fi
    
    print_success "Modal token is configured"
}

# Check OpenAI secret
check_openai_secret() {
    print_status "Checking OpenAI API key..."
    
    # Try to check if the secret exists (this might fail if not set up)
    if ! modal secret list | grep -q "openai-secret" 2>/dev/null; then
        print_warning "OpenAI API key not found in Modal secrets."
        print_warning "Please set up your OpenAI API key:"
        print_warning "1. Get API key from: https://platform.openai.com/api-keys"
        print_warning "2. Run: modal secret create openai-secret OPENAI_API_KEY=sk-your-key-here"
        print_warning "3. Or visit: https://modal.com/secrets/create"
        return 1
    fi
    
    print_success "OpenAI API key is configured"
}

# Clone devlooper if not exists
setup_devlooper() {
    local devlooper_dir="tools/devlooper"
    
    if [ ! -d "$devlooper_dir" ]; then
        print_status "Cloning devlooper..."
        mkdir -p tools
        git clone https://github.com/modal-labs/devlooper.git "$devlooper_dir"
        print_status "Devlooper cloned successfully"
    else
        print_status "Devlooper already cloned"
    fi
    
    print_success "Devlooper is ready"
}

# Generate CRISPR analysis code
generate_crispr_code() {
    local prompt="$1"
    local output_dir="generated/crispr"
    
    print_status "Generating CRISPR analysis code..."
    print_status "Prompt: $prompt"
    
    mkdir -p "$output_dir"
    
    cd tools/devlooper
    modal run -m src.main \
        --prompt="$prompt" \
        --template="python" \
        --output-path="../../$output_dir"
    cd ../..
    
    print_success "CRISPR code generated in $output_dir"
}

# Generate React component
generate_react_component() {
    local prompt="$1"
    local output_dir="generated/react"
    
    print_status "Generating React component..."
    print_status "Prompt: $prompt"
    
    mkdir -p "$output_dir"
    
    cd tools/devlooper
    modal run -m src.main \
        --prompt="$prompt" \
        --template="react" \
        --output-path="../../$output_dir"
    cd ../..
    
    print_success "React component generated in $output_dir"
}

# Generate bioinformatics utility
generate_bioinformatics_util() {
    local prompt="$1"
    local output_dir="generated/bioinformatics"
    
    print_status "Generating bioinformatics utility..."
    print_status "Prompt: $prompt"
    
    mkdir -p "$output_dir"
    
    cd tools/devlooper
    modal run -m src.main \
        --prompt="$prompt" \
        --template="python" \
        --output-path="../../$output_dir"
    cd ../..
    
    print_success "Bioinformatics utility generated in $output_dir"
}

# Predefined prompts for TracSeq ON
run_predefined_prompts() {
    print_status "Running predefined prompts for TracSeq ON..."
    
    # CRISPR-specific algorithms
    generate_crispr_code "A Python library for CRISPR guide RNA scoring that calculates on-target and off-target scores using machine learning models. Should include functions for PAM site detection, guide RNA efficiency prediction, and off-target risk assessment."
    
    generate_crispr_code "A Python module for DNA sequence analysis that can identify optimal cut sites, calculate GC content, detect repetitive sequences, and validate guide RNA sequences for CRISPR applications."
    
    # React components for the UI
    generate_react_component "A React component for displaying CRISPR analysis results in a data table with sorting, filtering, and export functionality. Should include visualization of scores, target sites, and off-target predictions."
    
    generate_react_component "A React component for DNA sequence input and validation that highlights PAM sites, shows GC content, and provides real-time validation feedback for CRISPR guide RNA design."
    
    # Bioinformatics utilities
    generate_bioinformatics_util "A Python library for processing Oxford Nanopore sequencing data that can parse FAST5 files, extract quality scores, and perform basic sequence analysis including length distribution and quality metrics."
    
    print_success "All predefined prompts completed!"
}

# Show help
show_help() {
    echo "TracSeq ON Devlooper Integration"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup                    Set up devlooper and dependencies"
    echo "  crispr \"<prompt>\"        Generate CRISPR analysis code"
    echo "  react \"<prompt>\"         Generate React component"
    echo "  bio \"<prompt>\"           Generate bioinformatics utility"
    echo "  presets                  Run predefined prompts for TracSeq ON"
    echo "  help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 crispr \"A guide RNA optimization algorithm\""
    echo "  $0 react \"A sequence visualization component\""
    echo "  $0 bio \"A FASTQ file parser\""
    echo "  $0 presets"
}

# Main function
main() {
    local command=${1:-help}
    
    case $command in
        setup)
            check_modal
            setup_modal_token
            check_openai_secret
            setup_devlooper
            ;;
        crispr)
            if [ -z "$2" ]; then
                print_error "Please provide a prompt for CRISPR code generation"
                exit 1
            fi
            generate_crispr_code "$2"
            ;;
        react)
            if [ -z "$2" ]; then
                print_error "Please provide a prompt for React component generation"
                exit 1
            fi
            generate_react_component "$2"
            ;;
        bio)
            if [ -z "$2" ]; then
                print_error "Please provide a prompt for bioinformatics utility generation"
                exit 1
            fi
            generate_bioinformatics_util "$2"
            ;;
        presets)
            run_predefined_prompts
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@" 