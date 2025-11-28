
// Performance monitoring for Interview AI
const { performance } = require('perf_hooks');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            audioProcessing: [],
            responseTime: [],
            memoryUsage: []
        };
        this.startTime = performance.now();
    }

    measureAudioProcessing(callback) {
        const start = performance.now();
        const result = callback();
        const duration = performance.now() - start;
        this.metrics.audioProcessing.push(duration);
        return result;
    }

    measureResponseTime(callback) {
        const start = performance.now();
        const result = callback();
        const duration = performance.now() - start;
        this.metrics.responseTime.push(duration);
        return result;
    }

    getAverageMetrics() {
        return {
            avgAudioProcessing: this.getAverage(this.metrics.audioProcessing),
            avgResponseTime: this.getAverage(this.metrics.responseTime),
            memoryUsage: process.memoryUsage(),
            uptime: performance.now() - this.startTime
        };
    }

    getAverage(array) {
        return array.length > 0 ? array.reduce((a, b) => a + b, 0) / array.length : 0;
    }

    logMetrics() {
        const metrics = this.getAverageMetrics();
        console.log('📊 Performance Metrics:', {
            'Audio Processing (ms)': metrics.avgAudioProcessing.toFixed(2),
            'Response Time (ms)': metrics.avgResponseTime.toFixed(2),
            'Memory Usage (MB)': (metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
            'Uptime (s)': (metrics.uptime / 1000).toFixed(2)
        });
    }
}

module.exports = PerformanceMonitor;
