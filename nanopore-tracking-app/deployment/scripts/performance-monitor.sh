#!/bin/bash

# Performance Monitoring Script for Nanopore Tracking App
# This script monitors performance metrics and provides scaling recommendations

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
MAGENTA='\033[0;35m'
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

log_perf() {
    echo -e "${MAGENTA}[PERF]${NC} $1"
}

# Function to get pod names
get_pod_names() {
    oc get pods -l "$APP_LABEL" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo ""
}

# Function to get pod resource usage (simulated since oc top isn't available)
get_pod_resources() {
    local pod_name="$1"
    
    # Get resource limits and requests
    local limits
    limits=$(oc get pod "$pod_name" -o jsonpath='{.spec.containers[0].resources.limits}' 2>/dev/null || echo "{}")
    
    local requests
    requests=$(oc get pod "$pod_name" -o jsonpath='{.spec.containers[0].resources.requests}' 2>/dev/null || echo "{}")
    
    echo "limits=$limits,requests=$requests"
}

# Function to get application health metrics
get_health_metrics() {
    local pod_name="$1"
    local stats
    
    stats=$(oc exec "$pod_name" -- wget -qO- "http://$SERVICE_IP:$SERVICE_PORT$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
    
    if [ "$stats" != "{}" ]; then
        echo "$stats"
    else
        echo "{}"
    fi
}

# Function to test response time
test_response_time() {
    local endpoint="$1"
    local pod_name="$2"
    local iterations="${3:-5}"
    
    local total_time=0
    local successful_requests=0
    
    for i in $(seq 1 $iterations); do
        local start_time
        start_time=$(date +%s%3N)
        
        if oc exec "$pod_name" -- wget -qO- "http://$SERVICE_IP:$SERVICE_PORT$endpoint" >/dev/null 2>&1; then
            local end_time
            end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            total_time=$((total_time + response_time))
            successful_requests=$((successful_requests + 1))
        fi
        
        sleep 0.5
    done
    
    if [ $successful_requests -gt 0 ]; then
        local avg_time=$((total_time / successful_requests))
        echo "$avg_time,$successful_requests,$iterations"
    else
        echo "0,0,$iterations"
    fi
}

# Function to load test the application
load_test() {
    local pod_name="$1"
    local concurrent_requests="${2:-5}"
    local duration="${3:-30}"
    
    log_info "Running load test with $concurrent_requests concurrent requests for ${duration}s"
    
    local end_time=$(($(date +%s) + duration))
    local total_requests=0
    local successful_requests=0
    local failed_requests=0
    local total_response_time=0
    
    # Create background processes for concurrent requests
    local pids=()
    
    while [ $(date +%s) -lt $end_time ]; do
        # Launch concurrent requests
        for i in $(seq 1 $concurrent_requests); do
            {
                local start_time
                start_time=$(date +%s%3N)
                
                if oc exec "$pod_name" -- wget -qO- "http://$SERVICE_IP:$SERVICE_PORT/health" >/dev/null 2>&1; then
                    local end_time_req
                    end_time_req=$(date +%s%3N)
                    local response_time=$((end_time_req - start_time))
                    echo "success,$response_time"
                else
                    echo "failed,0"
                fi
            } &
            pids+=($!)
        done
        
        # Wait for all requests to complete
        for pid in "${pids[@]}"; do
            wait $pid
            local result
            result=$(jobs -p | grep -q $pid && echo "timeout" || echo "completed")
        done
        
        # Count results
        total_requests=$((total_requests + concurrent_requests))
        
        # Reset pids array
        pids=()
        
        sleep 1
    done
    
    echo "$total_requests,$successful_requests,$failed_requests,$total_response_time"
}

# Function to analyze performance metrics
analyze_performance() {
    local pod_name="$1"
    
    log_info "Analyzing performance for pod: $pod_name"
    
    # Get health metrics
    local health_stats
    health_stats=$(get_health_metrics "$pod_name")
    
    if [ "$health_stats" != "{}" ] && command -v jq >/dev/null 2>&1; then
        # Memory metrics
        local memory_usage memory_status memory_trend
        memory_usage=$(echo "$health_stats" | jq -r '.components.memory.details.usagePercent // 0')
        memory_status=$(echo "$health_stats" | jq -r '.components.memory.status // "unknown"')
        memory_trend=$(echo "$health_stats" | jq -r '.components.memory.details.trend // "unknown"')
        
        log_metric "Memory Usage: ${memory_usage}% (Status: $memory_status, Trend: $memory_trend)"
        
        # Database metrics
        local db_status db_response_time
        db_status=$(echo "$health_stats" | jq -r '.components.database.status // "unknown"')
        db_response_time=$(echo "$health_stats" | jq -r '.components.database.details.responseTime // 0')
        
        log_metric "Database: $db_status (Response: ${db_response_time}ms)"
        
        # Cache metrics
        local cache_status cache_hit_rate
        cache_status=$(echo "$health_stats" | jq -r '.components.cache.status // "unknown"')
        cache_hit_rate=$(echo "$health_stats" | jq -r '.components.cache.details.hitRate // 0')
        
        log_metric "Cache: $cache_status (Hit Rate: ${cache_hit_rate}%)"
    fi
    
    # Test response times
    log_info "Testing response times..."
    local health_response
    health_response=$(test_response_time "/health" "$pod_name" 10)
    
    local avg_time successful total
    IFS=',' read -r avg_time successful total <<< "$health_response"
    
    log_metric "Health Endpoint: ${avg_time}ms average (${successful}/${total} successful)"
    
    # Performance classification
    if [ "$avg_time" -lt 100 ]; then
        log_success "Excellent response time (<100ms)"
    elif [ "$avg_time" -lt 500 ]; then
        log_success "Good response time (<500ms)"
    elif [ "$avg_time" -lt 1000 ]; then
        log_warning "Moderate response time (<1s)"
    else
        log_error "Poor response time (>1s)"
    fi
}

# Function to check resource utilization
check_resource_utilization() {
    local pod_name="$1"
    
    log_info "Checking resource utilization for pod: $pod_name"
    
    # Get resource limits and requests
    local resource_info
    resource_info=$(get_pod_resources "$pod_name")
    
    # Parse limits and requests
    local limits requests
    IFS=',' read -r limits requests <<< "$resource_info"
    
    log_metric "Resource Limits: $limits"
    log_metric "Resource Requests: $requests"
    
    # Get current pod status
    local pod_status
    pod_status=$(oc get pod "$pod_name" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
    
    log_metric "Pod Status: $pod_status"
    
    # Check restart count
    local restart_count
    restart_count=$(oc get pod "$pod_name" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
    
    log_metric "Restart Count: $restart_count"
    
    if [ "$restart_count" -gt 0 ]; then
        log_warning "Pod has restarted $restart_count times - investigate stability issues"
    fi
}

# Function to provide scaling recommendations
provide_scaling_recommendations() {
    local pod_count="$1"
    local avg_memory_usage="$2"
    local avg_response_time="$3"
    local restart_count="$4"
    
    echo ""
    log_info "Scaling Recommendations:"
    echo "========================================"
    
    # Current state analysis
    echo "Current State:"
    echo "  - Pods: $pod_count"
    echo "  - Memory Usage: ${avg_memory_usage}%"
    echo "  - Response Time: ${avg_response_time}ms"
    echo "  - Restart Count: $restart_count"
    echo ""
    
    # Memory-based recommendations
    if (( $(echo "$avg_memory_usage > 85" | bc -l 2>/dev/null || echo 0) )); then
        echo "🔴 URGENT SCALING NEEDED:"
        echo "  1. Increase memory limits to 768Mi or 1Gi"
        echo "  2. Scale horizontally to 3-4 replicas"
        echo "  3. Consider vertical pod autoscaling"
        echo ""
        echo "Commands:"
        echo "  oc patch deployment nanopore-tracking-app -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"nanopore-tracking-app\",\"resources\":{\"limits\":{\"memory\":\"768Mi\",\"cpu\":\"500m\"},\"requests\":{\"memory\":\"384Mi\",\"cpu\":\"250m\"}}}]}}}}'"
        echo "  oc scale deployment nanopore-tracking-app --replicas=3"
        echo ""
    elif (( $(echo "$avg_memory_usage > 70" | bc -l 2>/dev/null || echo 0) )); then
        echo "🟡 SCALING RECOMMENDED:"
        echo "  1. Consider increasing memory limits to 640Mi"
        echo "  2. Scale to 2-3 replicas for better distribution"
        echo "  3. Monitor trends closely"
        echo ""
    else
        echo "🟢 SCALING STATUS: HEALTHY"
        echo "  1. Current resources appear adequate"
        echo "  2. Consider scaling for high availability (2 replicas minimum)"
        echo ""
    fi
    
    # Response time-based recommendations
    if [ "$avg_response_time" -gt 1000 ]; then
        echo "Performance Optimizations:"
        echo "  1. Scale horizontally to distribute load"
        echo "  2. Increase CPU limits to 500m-1000m"
        echo "  3. Consider caching optimizations"
        echo "  4. Review database query performance"
        echo ""
    fi
    
    # Restart-based recommendations
    if [ "$restart_count" -gt 2 ]; then
        echo "Stability Improvements:"
        echo "  1. Increase memory limits (likely OOMKilled)"
        echo "  2. Add liveness/readiness probe tuning"
        echo "  3. Review application logs for errors"
        echo ""
    fi
    
    # High availability recommendations
    if [ "$pod_count" -eq 1 ]; then
        echo "High Availability:"
        echo "  1. Scale to minimum 2 replicas for HA"
        echo "  2. Configure pod disruption budgets"
        echo "  3. Use anti-affinity rules for pod distribution"
        echo ""
        echo "Command:"
        echo "  oc scale deployment nanopore-tracking-app --replicas=2"
        echo ""
    fi
    
    # Auto-scaling recommendations
    echo "Auto-scaling Setup:"
    echo "  1. Configure Horizontal Pod Autoscaler (HPA)"
    echo "  2. Set CPU target: 70%"
    echo "  3. Set memory target: 80%"
    echo "  4. Min replicas: 2, Max replicas: 5"
    echo ""
    echo "HPA Command:"
    echo "  oc autoscale deployment nanopore-tracking-app --cpu-percent=70 --min=2 --max=5"
}

# Function to monitor continuously
monitor_continuously() {
    local interval="${1:-30}"
    local duration="${2:-300}"
    local end_time=$(($(date +%s) + duration))
    
    log_info "Starting continuous performance monitoring for ${duration}s (interval: ${interval}s)"
    echo "Time,Pod,MemoryUsage%,ResponseTime_ms,Status,RestartCount"
    
    while [ $(date +%s) -lt $end_time ]; do
        local pods
        pods=$(get_pod_names)
        
        for pod in $pods; do
            local health_stats
            health_stats=$(get_health_metrics "$pod")
            
            local memory_usage="N/A"
            local status="Unknown"
            
            if [ "$health_stats" != "{}" ] && command -v jq >/dev/null 2>&1; then
                memory_usage=$(echo "$health_stats" | jq -r '.components.memory.details.usagePercent // "N/A"')
                status=$(echo "$health_stats" | jq -r '.status // "Unknown"')
            fi
            
            # Test response time
            local response_test
            response_test=$(test_response_time "/health" "$pod" 1)
            local response_time
            response_time=$(echo "$response_test" | cut -d',' -f1)
            
            # Get restart count
            local restart_count
            restart_count=$(oc get pod "$pod" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
            
            echo "$(date '+%H:%M:%S'),$pod,$memory_usage,$response_time,$status,$restart_count"
        done
        
        sleep "$interval"
    done
}

# Function to generate performance report
generate_performance_report() {
    local pods
    pods=$(get_pod_names)
    
    if [ -z "$pods" ]; then
        log_error "No pods found with label $APP_LABEL"
        return 1
    fi
    
    echo ""
    echo "======================================="
    echo "  PERFORMANCE MONITORING REPORT"
    echo "  $(date)"
    echo "======================================="
    echo ""
    
    local pod_count=0
    local total_memory_usage=0
    local total_response_time=0
    local total_restart_count=0
    
    for pod in $pods; do
        log_info "Analyzing pod: $pod"
        
        # Performance analysis
        analyze_performance "$pod"
        
        echo ""
        
        # Resource utilization
        check_resource_utilization "$pod"
        
        echo ""
        
        # Accumulate metrics for recommendations
        local health_stats
        health_stats=$(get_health_metrics "$pod")
        
        if [ "$health_stats" != "{}" ] && command -v jq >/dev/null 2>&1; then
            local memory_usage
            memory_usage=$(echo "$health_stats" | jq -r '.components.memory.details.usagePercent // 0')
            total_memory_usage=$(echo "$total_memory_usage + $memory_usage" | bc -l 2>/dev/null || echo "$total_memory_usage")
        fi
        
        # Response time
        local response_test
        response_test=$(test_response_time "/health" "$pod" 3)
        local response_time
        response_time=$(echo "$response_test" | cut -d',' -f1)
        total_response_time=$((total_response_time + response_time))
        
        # Restart count
        local restart_count
        restart_count=$(oc get pod "$pod" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
        total_restart_count=$((total_restart_count + restart_count))
        
        pod_count=$((pod_count + 1))
        
        echo "================================"
        echo ""
    done
    
    # Generate recommendations
    if [ $pod_count -gt 0 ]; then
        local avg_memory_usage avg_response_time
        
        if command -v bc >/dev/null 2>&1; then
            avg_memory_usage=$(echo "scale=2; $total_memory_usage / $pod_count" | bc -l)
        else
            avg_memory_usage="N/A"
        fi
        
        avg_response_time=$((total_response_time / pod_count))
        
        provide_scaling_recommendations "$pod_count" "$avg_memory_usage" "$avg_response_time" "$total_restart_count"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  report              Generate performance report (default)"
    echo "  monitor [interval]  Monitor continuously"
    echo "  loadtest [conc]     Run load test"
    echo "  scale [replicas]    Scale application"
    echo "  help                Show this help message"
    echo ""
    echo "Options:"
    echo "  interval            Monitoring interval in seconds (default: 30)"
    echo "  duration            Monitoring duration in seconds (default: 300)"
    echo "  conc                Concurrent requests for load test (default: 5)"
    echo "  replicas            Number of replicas to scale to"
    echo ""
    echo "Examples:"
    echo "  $0                  # Generate performance report"
    echo "  $0 monitor 15       # Monitor every 15 seconds"
    echo "  $0 loadtest 10      # Load test with 10 concurrent requests"
    echo "  $0 scale 3          # Scale to 3 replicas"
    echo ""
}

# Function to scale application
scale_application() {
    local replicas="$1"
    
    log_info "Scaling application to $replicas replicas..."
    
    if oc scale deployment nanopore-tracking-app --replicas="$replicas"; then
        log_success "Scaling command executed successfully"
        
        log_info "Waiting for rollout to complete..."
        oc rollout status deployment/nanopore-tracking-app --timeout=120s
        
        log_success "Application scaled to $replicas replicas"
        
        # Show new pod status
        log_info "New pod status:"
        oc get pods -l "$APP_LABEL"
    else
        log_error "Failed to scale application"
        return 1
    fi
}

# Main function
main() {
    local command="${1:-report}"
    
    case "$command" in
        "report")
            generate_performance_report
            ;;
        "monitor")
            local interval="${2:-30}"
            local duration="${3:-300}"
            monitor_continuously "$interval" "$duration"
            ;;
        "loadtest")
            local concurrent="${2:-5}"
            local pod_name
            pod_name=$(get_pod_names | awk '{print $1}')
            if [ -n "$pod_name" ]; then
                load_test "$pod_name" "$concurrent" 60
            else
                log_error "No pods found for load testing"
                exit 1
            fi
            ;;
        "scale")
            local replicas="${2:-2}"
            scale_application "$replicas"
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