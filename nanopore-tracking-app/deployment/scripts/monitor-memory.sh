#!/bin/bash

# Memory Monitoring Script for Nanopore Tracking App
# This script monitors memory usage and provides optimization recommendations

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
APP_LABEL="app=nanopore-tracking-app"
SERVICE_IP="172.30.36.13"
SERVICE_PORT="3001"
HEALTH_ENDPOINT="/health"
METRICS_ENDPOINT="/api/metrics"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1"
}

# Function to get pod names
get_pod_names() {
    oc get pods -l "$APP_LABEL" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo ""
}

# Function to get memory stats from health endpoint
get_memory_stats() {
    local pod_name="$1"
    local stats
    
    stats=$(oc exec "$pod_name" -- wget -qO- "http://$SERVICE_IP:$SERVICE_PORT$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
    
    if [ "$stats" != "{}" ]; then
        echo "$stats"
    else
        echo "{}"
    fi
}

# Function to parse memory stats
parse_memory_stats() {
    local stats="$1"
    local component="$2"
    
    if command -v jq >/dev/null 2>&1; then
        echo "$stats" | jq -r ".components.$component.details // {}"
    else
        # Fallback parsing without jq
        echo "$stats" | grep -o "\"$component\":{[^}]*}" | head -1 || echo "{}"
    fi
}

# Function to check memory thresholds
check_memory_thresholds() {
    local heap_percent="$1"
    local rss_mb="$2"
    local pod_name="$3"
    
    if (( $(echo "$heap_percent > 95" | bc -l) )); then
        log_error "CRITICAL: Pod $pod_name heap usage at ${heap_percent}% (>95%)"
        return 2
    elif (( $(echo "$heap_percent > 85" | bc -l) )); then
        log_warning "HIGH: Pod $pod_name heap usage at ${heap_percent}% (>85%)"
        return 1
    elif (( $(echo "$heap_percent > 70" | bc -l) )); then
        log_warning "MODERATE: Pod $pod_name heap usage at ${heap_percent}% (>70%)"
        return 1
    else
        log_success "GOOD: Pod $pod_name heap usage at ${heap_percent}% (<70%)"
        return 0
    fi
}

# Function to get resource limits
get_resource_limits() {
    local pod_name="$1"
    
    log_info "Resource limits for $pod_name:"
    oc get pod "$pod_name" -o jsonpath='{.spec.containers[0].resources}' | \
    sed 's/,/\n/g' | sed 's/[{}]//g' | sed 's/:/: /g' | \
    while read -r line; do
        if [ -n "$line" ]; then
            echo "  $line"
        fi
    done
}

# Function to provide memory optimization recommendations
provide_recommendations() {
    local avg_heap_percent="$1"
    local max_rss_mb="$2"
    local pod_count="$3"
    
    echo ""
    log_info "Memory Optimization Recommendations:"
    echo "=================================="
    
    if (( $(echo "$avg_heap_percent > 85" | bc -l) )); then
        echo "🔴 URGENT ACTIONS NEEDED:"
        echo "  1. Increase memory limits from 384Mi to 512Mi or 768Mi"
        echo "  2. Enable garbage collection with --expose-gc flag"
        echo "  3. Consider reducing Node.js max-old-space-size"
        echo "  4. Scale horizontally (add more replicas)"
        echo ""
        echo "  Command to increase memory limits:"
        echo "  oc patch deployment nanopore-tracking-app -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"nanopore-tracking-app\",\"resources\":{\"limits\":{\"memory\":\"512Mi\"},\"requests\":{\"memory\":\"256Mi\"}}}]}}}}'"
        echo ""
    elif (( $(echo "$avg_heap_percent > 70" | bc -l) )); then
        echo "🟡 RECOMMENDED ACTIONS:"
        echo "  1. Monitor memory trends closely"
        echo "  2. Consider increasing memory limits to 512Mi"
        echo "  3. Enable garbage collection optimization"
        echo "  4. Review application caching strategies"
        echo ""
    else
        echo "🟢 MEMORY USAGE IS HEALTHY"
        echo "  1. Continue monitoring"
        echo "  2. Current limits appear adequate"
        echo "  3. Consider optimizing for better performance"
        echo ""
    fi
    
    echo "Configuration Optimizations:"
    echo "  1. Update NODE_OPTIONS to include --expose-gc"
    echo "  2. Adjust cache settings (current max: 1000 entries)"
    echo "  3. Consider implementing memory-efficient data structures"
    echo "  4. Review PDF processing memory usage"
    echo ""
    
    if [ "$pod_count" -eq 1 ]; then
        echo "Scaling Recommendations:"
        echo "  1. Current: 1 pod (single point of failure)"
        echo "  2. Recommended: Scale to 2-3 pods for better distribution"
        echo "  3. Command: oc scale deployment nanopore-tracking-app --replicas=2"
        echo ""
    fi
}

# Function to monitor memory continuously
monitor_continuously() {
    local interval="${1:-30}"
    local duration="${2:-300}"
    local end_time=$(($(date +%s) + duration))
    
    log_info "Starting continuous memory monitoring for ${duration}s (interval: ${interval}s)"
    echo "Time,Pod,HeapUsed%,HeapUsedMB,HeapTotalMB,RSS_MB,Status"
    
    while [ $(date +%s) -lt $end_time ]; do
        local pods
        pods=$(get_pod_names)
        
        for pod in $pods; do
            local stats
            stats=$(get_memory_stats "$pod")
            
            if [ "$stats" != "{}" ]; then
                local memory_details
                memory_details=$(parse_memory_stats "$stats" "memory")
                
                if command -v jq >/dev/null 2>&1; then
                    local heap_percent rss_mb heap_used_mb heap_total_mb status
                    heap_percent=$(echo "$memory_details" | jq -r '.usagePercent // 0')
                    rss_mb=$(echo "$memory_details" | jq -r '.rss // 0' | awk '{print int($1/1024/1024)}')
                    heap_used_mb=$(echo "$memory_details" | jq -r '.heapUsed // 0' | awk '{print int($1/1024/1024)}')
                    heap_total_mb=$(echo "$memory_details" | jq -r '.heapTotal // 0' | awk '{print int($1/1024/1024)}')
                    status=$(echo "$stats" | jq -r '.components.memory.status // "unknown"')
                    
                    echo "$(date '+%H:%M:%S'),$pod,$heap_percent,$heap_used_mb,$heap_total_mb,$rss_mb,$status"
                else
                    echo "$(date '+%H:%M:%S'),$pod,N/A,N/A,N/A,N/A,jq_not_available"
                fi
            fi
        done
        
        sleep "$interval"
    done
}

# Function to generate memory report
generate_memory_report() {
    local pods
    pods=$(get_pod_names)
    
    if [ -z "$pods" ]; then
        log_error "No pods found with label $APP_LABEL"
        return 1
    fi
    
    echo ""
    echo "======================================="
    echo "  MEMORY USAGE REPORT"
    echo "  $(date)"
    echo "======================================="
    echo ""
    
    local total_heap_percent=0
    local max_rss_mb=0
    local pod_count=0
    
    for pod in $pods; do
        log_info "Analyzing pod: $pod"
        
        local stats
        stats=$(get_memory_stats "$pod")
        
        if [ "$stats" != "{}" ]; then
            local memory_details
            memory_details=$(parse_memory_stats "$stats" "memory")
            
            if command -v jq >/dev/null 2>&1; then
                local heap_percent rss_mb heap_used_mb heap_total_mb status trend
                heap_percent=$(echo "$memory_details" | jq -r '.usagePercent // 0')
                rss_mb=$(echo "$memory_details" | jq -r '.rss // 0' | awk '{print int($1/1024/1024)}')
                heap_used_mb=$(echo "$memory_details" | jq -r '.heapUsed // 0' | awk '{print int($1/1024/1024)}')
                heap_total_mb=$(echo "$memory_details" | jq -r '.heapTotal // 0' | awk '{print int($1/1024/1024)}')
                status=$(echo "$stats" | jq -r '.components.memory.status // "unknown"')
                trend=$(echo "$memory_details" | jq -r '.trend // "unknown"')
                
                log_metric "Heap Usage: ${heap_percent}% (${heap_used_mb}MB / ${heap_total_mb}MB)"
                log_metric "RSS Memory: ${rss_mb}MB"
                log_metric "Status: $status"
                log_metric "Trend: $trend"
                
                check_memory_thresholds "$heap_percent" "$rss_mb" "$pod"
                
                # Get resource limits
                get_resource_limits "$pod"
                
                # Accumulate stats
                total_heap_percent=$(echo "$total_heap_percent + $heap_percent" | bc -l)
                if (( $(echo "$rss_mb > $max_rss_mb" | bc -l) )); then
                    max_rss_mb=$rss_mb
                fi
                pod_count=$((pod_count + 1))
            else
                log_warning "jq not available. Install jq for detailed memory analysis."
                echo "Raw stats: $stats"
            fi
        else
            log_error "Failed to get memory stats for pod: $pod"
        fi
        
        echo ""
    done
    
    # Generate recommendations
    if [ $pod_count -gt 0 ] && command -v bc >/dev/null 2>&1; then
        local avg_heap_percent
        avg_heap_percent=$(echo "scale=2; $total_heap_percent / $pod_count" | bc -l)
        provide_recommendations "$avg_heap_percent" "$max_rss_mb" "$pod_count"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  report              Generate memory usage report (default)"
    echo "  monitor [interval]  Monitor continuously (default: 30s intervals)"
    echo "  optimize           Apply memory optimizations"
    echo "  help               Show this help message"
    echo ""
    echo "Options for monitor:"
    echo "  interval            Monitoring interval in seconds (default: 30)"
    echo "  duration            Total monitoring duration in seconds (default: 300)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Generate memory report"
    echo "  $0 report                    # Generate memory report"
    echo "  $0 monitor                   # Monitor for 5 minutes with 30s intervals"
    echo "  $0 monitor 10                # Monitor with 10s intervals"
    echo "  $0 optimize                  # Apply memory optimizations"
    echo ""
}

# Function to apply memory optimizations
apply_optimizations() {
    log_info "Applying memory optimizations..."
    
    # 1. Update NODE_OPTIONS to include garbage collection
    log_info "Updating NODE_OPTIONS to enable garbage collection..."
    oc patch deployment nanopore-tracking-app -p '{
        "spec": {
            "template": {
                "spec": {
                    "containers": [{
                        "name": "nanopore-tracking-app",
                        "env": [{
                            "name": "NODE_OPTIONS",
                            "value": "--max-old-space-size=200 --expose-gc"
                        }]
                    }]
                }
            }
        }
    }' || log_warning "Failed to update NODE_OPTIONS"
    
    # 2. Increase memory limits
    log_info "Increasing memory limits to 512Mi..."
    oc patch deployment nanopore-tracking-app -p '{
        "spec": {
            "template": {
                "spec": {
                    "containers": [{
                        "name": "nanopore-tracking-app",
                        "resources": {
                            "limits": {
                                "memory": "512Mi"
                            },
                            "requests": {
                                "memory": "256Mi"
                            }
                        }
                    }]
                }
            }
        }
    }' || log_warning "Failed to update memory limits"
    
    log_success "Memory optimizations applied. Deployment will restart automatically."
    log_info "Monitor the rollout with: oc rollout status deployment/nanopore-tracking-app"
}

# Main function
main() {
    local command="${1:-report}"
    
    case "$command" in
        "report")
            generate_memory_report
            ;;
        "monitor")
            local interval="${2:-30}"
            local duration="${3:-300}"
            monitor_continuously "$interval" "$duration"
            ;;
        "optimize")
            apply_optimizations
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Check prerequisites
if ! command -v oc >/dev/null 2>&1; then
    log_error "OpenShift CLI (oc) is required but not installed"
    exit 1
fi

if ! command -v bc >/dev/null 2>&1; then
    log_warning "bc calculator not available. Some calculations may be limited."
fi

# Run main function
main "$@" 