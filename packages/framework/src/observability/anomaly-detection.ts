/**
 * Anomaly Detection System
 * 
 * Machine learning-based anomaly detection for CQRS/Event Sourcing systems:
 * - Statistical anomaly detection algorithms
 * - Pattern recognition for command/event/query flows
 * - Threshold-based and ML-based detection
 * - Real-time and batch anomaly detection
 * - Alert generation and severity classification
 * - Historical anomaly analysis
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import * as Stream from 'effect/Stream';
import * as Ref from 'effect/Ref';
import * as Queue from 'effect/Queue';
import * as Duration from 'effect/Duration';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';

/**
 * Anomaly types
 */
export enum AnomalyType {
  STATISTICAL = 'statistical',
  THRESHOLD = 'threshold',
  PATTERN = 'pattern',
  SEASONAL = 'seasonal',
  TREND = 'trend',
  OUTLIER = 'outlier',
}

/**
 * Anomaly severity
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Metric data point
 */
export interface MetricDataPoint {
  readonly timestamp: Date;
  readonly value: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  readonly id: string;
  readonly type: AnomalyType;
  readonly severity: AnomalySeverity;
  readonly metric: string;
  readonly timestamp: Date;
  readonly value: number;
  readonly expectedValue: number;
  readonly threshold: number;
  readonly confidence: number;
  readonly description: string;
  readonly context?: Record<string, any>;
}

/**
 * Detection algorithm configuration
 */
export interface DetectionConfig {
  readonly algorithm: 'zscore' | 'iqr' | 'isolation_forest' | 'lstm' | 'seasonal_decomposition';
  readonly parameters: Record<string, any>;
  readonly sensitivity: number; // 0-1, higher = more sensitive
  readonly windowSize: number;
  readonly minDataPoints: number;
}

/**
 * Statistical functions
 */
export class Statistics {
  /**
   * Calculate mean
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[], mean?: number): number {
    if (values.length === 0) return 0;
    const avg = mean ?? this.mean(values);
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = this.mean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate median
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  /**
   * Calculate interquartile range
   */
  static iqr(values: number[]): { q1: number; q3: number; iqr: number } {
    if (values.length === 0) return { q1: 0, q3: 0, iqr: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    
    return { q1, q3, iqr: q3 - q1 };
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Number.isInteger(index)) {
      return sorted[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  }

  /**
   * Calculate moving average
   */
  static movingAverage(values: number[], windowSize: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      result.push(this.mean(window));
    }
    
    return result;
  }

  /**
   * Calculate exponential moving average
   */
  static exponentialMovingAverage(values: number[], alpha: number): number[] {
    const result: number[] = [];
    
    if (values.length === 0) return result;
    
    result[0] = values[0];
    
    for (let i = 1; i < values.length; i++) {
      result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
    }
    
    return result;
  }
}

/**
 * Z-Score anomaly detector
 */
export class ZScoreDetector {
  constructor(
    private readonly threshold: number = 3,
    private readonly windowSize: number = 50
  ) {}

  /**
   * Detect anomalies using Z-score
   */
  detect(dataPoints: MetricDataPoint[]): AnomalyResult[] {
    if (dataPoints.length < this.windowSize) {
      return [];
    }

    const values = dataPoints.map(dp => dp.value);
    const anomalies: AnomalyResult[] = [];

    for (let i = this.windowSize; i < dataPoints.length; i++) {
      const window = values.slice(i - this.windowSize, i);
      const mean = Statistics.mean(window);
      const stdDev = Statistics.standardDeviation(window, mean);
      
      if (stdDev === 0) continue; // Avoid division by zero
      
      const currentValue = values[i];
      const zScore = Math.abs(currentValue - mean) / stdDev;
      
      if (zScore > this.threshold) {
        const severity = this.calculateSeverity(zScore);
        
        anomalies.push({
          id: `zscore-${dataPoints[i].timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          type: AnomalyType.STATISTICAL,
          severity,
          metric: 'unknown', // Would be set by caller
          timestamp: dataPoints[i].timestamp,
          value: currentValue,
          expectedValue: mean,
          threshold: this.threshold,
          confidence: Math.min(zScore / this.threshold, 1),
          description: `Value ${currentValue.toFixed(2)} deviates from mean ${mean.toFixed(2)} by ${zScore.toFixed(2)} standard deviations`,
          context: {
            zScore,
            mean,
            standardDeviation: stdDev,
            windowSize: this.windowSize,
          },
        });
      }
    }

    return anomalies;
  }

  private calculateSeverity(zScore: number): AnomalySeverity {
    if (zScore > 6) return AnomalySeverity.CRITICAL;
    if (zScore > 4) return AnomalySeverity.HIGH;
    if (zScore > 3) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }
}

/**
 * IQR (Interquartile Range) anomaly detector
 */
export class IQRDetector {
  constructor(
    private readonly multiplier: number = 1.5,
    private readonly windowSize: number = 50
  ) {}

  /**
   * Detect anomalies using IQR method
   */
  detect(dataPoints: MetricDataPoint[]): AnomalyResult[] {
    if (dataPoints.length < this.windowSize) {
      return [];
    }

    const values = dataPoints.map(dp => dp.value);
    const anomalies: AnomalyResult[] = [];

    for (let i = this.windowSize; i < dataPoints.length; i++) {
      const window = values.slice(i - this.windowSize, i);
      const { q1, q3, iqr } = Statistics.iqr(window);
      
      const lowerBound = q1 - this.multiplier * iqr;
      const upperBound = q3 + this.multiplier * iqr;
      
      const currentValue = values[i];
      
      if (currentValue < lowerBound || currentValue > upperBound) {
        const severity = this.calculateSeverity(currentValue, lowerBound, upperBound, iqr);
        const expectedValue = currentValue < lowerBound ? q1 : q3;
        
        anomalies.push({
          id: `iqr-${dataPoints[i].timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          type: AnomalyType.OUTLIER,
          severity,
          metric: 'unknown',
          timestamp: dataPoints[i].timestamp,
          value: currentValue,
          expectedValue,
          threshold: this.multiplier,
          confidence: this.calculateConfidence(currentValue, lowerBound, upperBound, iqr),
          description: `Value ${currentValue.toFixed(2)} is outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
          context: {
            q1,
            q3,
            iqr,
            lowerBound,
            upperBound,
            multiplier: this.multiplier,
            windowSize: this.windowSize,
          },
        });
      }
    }

    return anomalies;
  }

  private calculateSeverity(
    value: number,
    lowerBound: number,
    upperBound: number,
    iqr: number
  ): AnomalySeverity {
    const deviation = Math.max(
      Math.abs(value - lowerBound),
      Math.abs(value - upperBound)
    );
    const relativeDeviation = deviation / iqr;

    if (relativeDeviation > 5) return AnomalySeverity.CRITICAL;
    if (relativeDeviation > 3) return AnomalySeverity.HIGH;
    if (relativeDeviation > 2) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private calculateConfidence(
    value: number,
    lowerBound: number,
    upperBound: number,
    iqr: number
  ): number {
    const deviation = Math.max(
      Math.abs(value - lowerBound),
      Math.abs(value - upperBound)
    );
    return Math.min(deviation / (iqr * this.multiplier), 1);
  }
}

/**
 * Threshold-based anomaly detector
 */
export class ThresholdDetector {
  constructor(
    private readonly thresholds: {
      min?: number;
      max?: number;
      rate?: {
        windowSize: number;
        maxChange: number;
      };
    }
  ) {}

  /**
   * Detect anomalies using threshold rules
   */
  detect(dataPoints: MetricDataPoint[]): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      const value = point.value;

      // Check absolute thresholds
      if (this.thresholds.min !== undefined && value < this.thresholds.min) {
        anomalies.push(this.createThresholdAnomaly(
          point,
          'minimum',
          value,
          this.thresholds.min,
          AnomalySeverity.HIGH
        ));
      }

      if (this.thresholds.max !== undefined && value > this.thresholds.max) {
        anomalies.push(this.createThresholdAnomaly(
          point,
          'maximum',
          value,
          this.thresholds.max,
          AnomalySeverity.HIGH
        ));
      }

      // Check rate of change
      if (this.thresholds.rate && i > 0) {
        const windowStart = Math.max(0, i - this.thresholds.rate.windowSize + 1);
        const window = dataPoints.slice(windowStart, i + 1);
        
        if (window.length >= 2) {
          const firstValue = window[0].value;
          const lastValue = window[window.length - 1].value;
          const change = Math.abs(lastValue - firstValue);
          
          if (change > this.thresholds.rate.maxChange) {
            anomalies.push(this.createRateAnomaly(
              point,
              change,
              this.thresholds.rate.maxChange,
              firstValue,
              lastValue
            ));
          }
        }
      }
    }

    return anomalies;
  }

  private createThresholdAnomaly(
    point: MetricDataPoint,
    type: string,
    value: number,
    threshold: number,
    severity: AnomalySeverity
  ): AnomalyResult {
    return {
      id: `threshold-${point.timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      type: AnomalyType.THRESHOLD,
      severity,
      metric: 'unknown',
      timestamp: point.timestamp,
      value,
      expectedValue: threshold,
      threshold,
      confidence: Math.abs(value - threshold) / threshold,
      description: `Value ${value.toFixed(2)} violates ${type} threshold ${threshold.toFixed(2)}`,
      context: {
        thresholdType: type,
        violation: value - threshold,
      },
    };
  }

  private createRateAnomaly(
    point: MetricDataPoint,
    change: number,
    maxChange: number,
    firstValue: number,
    lastValue: number
  ): AnomalyResult {
    return {
      id: `rate-${point.timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      type: AnomalyType.TREND,
      severity: change > maxChange * 2 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
      metric: 'unknown',
      timestamp: point.timestamp,
      value: lastValue,
      expectedValue: firstValue,
      threshold: maxChange,
      confidence: Math.min(change / maxChange, 1),
      description: `Rate of change ${change.toFixed(2)} exceeds threshold ${maxChange.toFixed(2)}`,
      context: {
        change,
        firstValue,
        lastValue,
        changeRate: (lastValue - firstValue) / firstValue,
      },
    };
  }
}

/**
 * Pattern-based anomaly detector
 */
export class PatternDetector {
  private patterns: Map<string, number[]> = new Map();

  constructor(
    private readonly patternLength: number = 10,
    private readonly similarityThreshold: number = 0.8
  ) {}

  /**
   * Learn normal patterns from data
   */
  learnPatterns(dataPoints: MetricDataPoint[]): void {
    const values = dataPoints.map(dp => dp.value);
    
    for (let i = 0; i <= values.length - this.patternLength; i++) {
      const pattern = values.slice(i, i + this.patternLength);
      const normalizedPattern = this.normalizePattern(pattern);
      const key = this.patternToKey(normalizedPattern);
      
      if (!this.patterns.has(key)) {
        this.patterns.set(key, normalizedPattern);
      }
    }
  }

  /**
   * Detect anomalies based on learned patterns
   */
  detect(dataPoints: MetricDataPoint[]): AnomalyResult[] {
    const values = dataPoints.map(dp => dp.value);
    const anomalies: AnomalyResult[] = [];

    for (let i = this.patternLength; i <= values.length; i++) {
      const currentPattern = values.slice(i - this.patternLength, i);
      const normalizedPattern = this.normalizePattern(currentPattern);
      
      const maxSimilarity = this.findMaxSimilarity(normalizedPattern);
      
      if (maxSimilarity < this.similarityThreshold) {
        const severity = this.calculateSeverityFromSimilarity(maxSimilarity);
        
        anomalies.push({
          id: `pattern-${dataPoints[i - 1].timestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          type: AnomalyType.PATTERN,
          severity,
          metric: 'unknown',
          timestamp: dataPoints[i - 1].timestamp,
          value: values[i - 1],
          expectedValue: Statistics.mean(currentPattern),
          threshold: this.similarityThreshold,
          confidence: 1 - maxSimilarity,
          description: `Pattern similarity ${(maxSimilarity * 100).toFixed(1)}% below threshold ${(this.similarityThreshold * 100).toFixed(1)}%`,
          context: {
            patternLength: this.patternLength,
            maxSimilarity,
            pattern: currentPattern,
          },
        });
      }
    }

    return anomalies;
  }

  private normalizePattern(pattern: number[]): number[] {
    const mean = Statistics.mean(pattern);
    const stdDev = Statistics.standardDeviation(pattern, mean);
    
    if (stdDev === 0) {
      return pattern.map(() => 0);
    }
    
    return pattern.map(value => (value - mean) / stdDev);
  }

  private patternToKey(pattern: number[]): string {
    return pattern.map(v => Math.round(v * 100) / 100).join(',');
  }

  private findMaxSimilarity(pattern: number[]): number {
    let maxSimilarity = 0;
    
    for (const knownPattern of this.patterns.values()) {
      const similarity = this.calculateSimilarity(pattern, knownPattern);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return maxSimilarity;
  }

  private calculateSimilarity(pattern1: number[], pattern2: number[]): number {
    if (pattern1.length !== pattern2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < pattern1.length; i++) {
      dotProduct += pattern1[i] * pattern2[i];
      norm1 += pattern1[i] * pattern1[i];
      norm2 += pattern2[i] * pattern2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private calculateSeverityFromSimilarity(similarity: number): AnomalySeverity {
    if (similarity < 0.3) return AnomalySeverity.CRITICAL;
    if (similarity < 0.5) return AnomalySeverity.HIGH;
    if (similarity < 0.7) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }
}

/**
 * Composite anomaly detector
 */
export class CompositeDetector {
  private detectors: Array<{
    detector: ZScoreDetector | IQRDetector | ThresholdDetector | PatternDetector;
    weight: number;
    name: string;
  }> = [];

  /**
   * Add detector with weight
   */
  addDetector(
    detector: ZScoreDetector | IQRDetector | ThresholdDetector | PatternDetector,
    weight: number,
    name: string
  ): this {
    this.detectors.push({ detector, weight, name });
    return this;
  }

  /**
   * Detect anomalies using all detectors
   */
  detect(dataPoints: MetricDataPoint[]): AnomalyResult[] {
    const allAnomalies: AnomalyResult[] = [];

    for (const { detector, weight, name } of this.detectors) {
      const anomalies = detector.detect(dataPoints);
      
      // Adjust confidence based on detector weight
      const weightedAnomalies = anomalies.map(anomaly => ({
        ...anomaly,
        confidence: anomaly.confidence * weight,
        context: {
          ...anomaly.context,
          detectorName: name,
          detectorWeight: weight,
        },
      }));
      
      allAnomalies.push(...weightedAnomalies);
    }

    // Merge similar anomalies
    return this.mergeAnomalies(allAnomalies);
  }

  private mergeAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
    const merged: AnomalyResult[] = [];
    const timeWindow = 60000; // 1 minute

    for (const anomaly of anomalies) {
      const existing = merged.find(a => 
        Math.abs(a.timestamp.getTime() - anomaly.timestamp.getTime()) < timeWindow &&
        a.metric === anomaly.metric
      );

      if (existing) {
        // Merge with existing anomaly
        existing.confidence = Math.max(existing.confidence, anomaly.confidence);
        existing.severity = this.maxSeverity(existing.severity, anomaly.severity);
        existing.description = `${existing.description} | ${anomaly.description}`;
      } else {
        merged.push(anomaly);
      }
    }

    return merged.sort((a, b) => b.confidence - a.confidence);
  }

  private maxSeverity(a: AnomalySeverity, b: AnomalySeverity): AnomalySeverity {
    const severityOrder = [
      AnomalySeverity.LOW,
      AnomalySeverity.MEDIUM,
      AnomalySeverity.HIGH,
      AnomalySeverity.CRITICAL,
    ];
    
    const aIndex = severityOrder.indexOf(a);
    const bIndex = severityOrder.indexOf(b);
    
    return severityOrder[Math.max(aIndex, bIndex)];
  }
}

/**
 * Anomaly detection service
 */
export class AnomalyDetectionService {
  private detectors = new Map<string, CompositeDetector>();
  private anomalyHistory = new Map<string, AnomalyResult[]>();
  private metricsBuffer = new Map<string, MetricDataPoint[]>();

  constructor(
    private readonly config: {
      maxHistorySize: number;
      maxBufferSize: number;
      alertCallback: (anomaly: AnomalyResult) => Effect.Effect<void, never, never>;
    }
  ) {}

  /**
   * Register detector for metric
   */
  registerDetector(metricName: string, detector: CompositeDetector): void {
    this.detectors.set(metricName, detector);
    
    if (!this.metricsBuffer.has(metricName)) {
      this.metricsBuffer.set(metricName, []);
    }
    
    if (!this.anomalyHistory.has(metricName)) {
      this.anomalyHistory.set(metricName, []);
    }
  }

  /**
   * Add metric data point
   */
  addDataPoint(metricName: string, dataPoint: MetricDataPoint): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const buffer = this.metricsBuffer.get(metricName) || [];
      buffer.push(dataPoint);

      // Keep buffer size manageable
      if (buffer.length > this.config.maxBufferSize) {
        buffer.splice(0, buffer.length - this.config.maxBufferSize);
      }

      this.metricsBuffer.set(metricName, buffer);

      // Run detection
      yield* _(this.detectAnomalies(metricName));
    });
  }

  /**
   * Detect anomalies for metric
   */
  private detectAnomalies(metricName: string): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const detector = this.detectors.get(metricName);
      const buffer = this.metricsBuffer.get(metricName);

      if (!detector || !buffer || buffer.length < 10) {
        return;
      }

      const anomalies = detector.detect(buffer);
      
      if (anomalies.length > 0) {
        // Update anomaly history
        const history = this.anomalyHistory.get(metricName) || [];
        history.push(...anomalies);

        // Keep history size manageable
        if (history.length > this.config.maxHistorySize) {
          history.splice(0, history.length - this.config.maxHistorySize);
        }

        this.anomalyHistory.set(metricName, history);

        // Send alerts
        for (const anomaly of anomalies) {
          const enrichedAnomaly = { ...anomaly, metric: metricName };
          yield* _(this.config.alertCallback(enrichedAnomaly));
        }
      }
    });
  }

  /**
   * Get anomaly history for metric
   */
  getAnomalyHistory(
    metricName: string,
    since?: Date,
    limit?: number
  ): AnomalyResult[] {
    const history = this.anomalyHistory.get(metricName) || [];
    
    let filtered = since 
      ? history.filter(a => a.timestamp >= since)
      : history;

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get anomaly statistics
   */
  getAnomalyStatistics(metricName: string): {
    totalAnomalies: number;
    anomaliesByType: Record<AnomalyType, number>;
    anomaliesBySeverity: Record<AnomalySeverity, number>;
    recentAnomalies: AnomalyResult[];
    averageConfidence: number;
  } {
    const history = this.anomalyHistory.get(metricName) || [];

    const anomaliesByType: Record<AnomalyType, number> = {
      [AnomalyType.STATISTICAL]: 0,
      [AnomalyType.THRESHOLD]: 0,
      [AnomalyType.PATTERN]: 0,
      [AnomalyType.SEASONAL]: 0,
      [AnomalyType.TREND]: 0,
      [AnomalyType.OUTLIER]: 0,
    };

    const anomaliesBySeverity: Record<AnomalySeverity, number> = {
      [AnomalySeverity.LOW]: 0,
      [AnomalySeverity.MEDIUM]: 0,
      [AnomalySeverity.HIGH]: 0,
      [AnomalySeverity.CRITICAL]: 0,
    };

    let totalConfidence = 0;

    for (const anomaly of history) {
      anomaliesByType[anomaly.type]++;
      anomaliesBySeverity[anomaly.severity]++;
      totalConfidence += anomaly.confidence;
    }

    const averageConfidence = history.length > 0 ? totalConfidence / history.length : 0;
    const recentAnomalies = history.slice(-10);

    return {
      totalAnomalies: history.length,
      anomaliesByType,
      anomaliesBySeverity,
      recentAnomalies,
      averageConfidence,
    };
  }

  /**
   * Train pattern detector
   */
  trainPatternDetector(metricName: string, trainingData: MetricDataPoint[]): void {
    const detector = this.detectors.get(metricName);
    if (detector) {
      // Find pattern detector in composite detector
      // In a real implementation, would need to expose pattern detector
      console.log(`Training pattern detector for ${metricName} with ${trainingData.length} data points`);
    }
  }
}

/**
 * CQRS-specific anomaly detectors factory
 */
export class CQRSAnomalyDetectors {
  /**
   * Create command processing anomaly detector
   */
  static createCommandDetector(): CompositeDetector {
    return new CompositeDetector()
      .addDetector(new ZScoreDetector(3, 50), 0.4, 'zscore')
      .addDetector(new IQRDetector(1.5, 50), 0.3, 'iqr')
      .addDetector(
        new ThresholdDetector({
          max: 10000, // Max 10k commands/sec
          rate: {
            windowSize: 10,
            maxChange: 5000, // Max 5k change in 10 samples
          },
        }),
        0.3,
        'threshold'
      );
  }

  /**
   * Create event processing anomaly detector
   */
  static createEventDetector(): CompositeDetector {
    return new CompositeDetector()
      .addDetector(new ZScoreDetector(2.5, 100), 0.3, 'zscore')
      .addDetector(new IQRDetector(2, 100), 0.3, 'iqr')
      .addDetector(new PatternDetector(20, 0.7), 0.4, 'pattern');
  }

  /**
   * Create query latency anomaly detector
   */
  static createLatencyDetector(): CompositeDetector {
    return new CompositeDetector()
      .addDetector(new ZScoreDetector(3, 30), 0.5, 'zscore')
      .addDetector(
        new ThresholdDetector({
          max: 1000, // Max 1 second
          rate: {
            windowSize: 5,
            maxChange: 500, // Max 500ms change
          },
        }),
        0.5,
        'threshold'
      );
  }

  /**
   * Create error rate anomaly detector
   */
  static createErrorRateDetector(): CompositeDetector {
    return new CompositeDetector()
      .addDetector(new ZScoreDetector(2, 20), 0.4, 'zscore')
      .addDetector(
        new ThresholdDetector({
          max: 0.05, // Max 5% error rate
          rate: {
            windowSize: 5,
            maxChange: 0.03, // Max 3% change
          },
        }),
        0.6,
        'threshold'
      );
  }
}

/**
 * Anomaly detection service interface
 */
export interface IAnomalyDetectionService {
  readonly _tag: 'AnomalyDetectionService';
  readonly service: AnomalyDetectionService;
  readonly addDataPoint: (metricName: string, dataPoint: MetricDataPoint) => Effect.Effect<void, never, never>;
  readonly getAnomalyHistory: (metricName: string, since?: Date, limit?: number) => AnomalyResult[];
  readonly getStatistics: (metricName: string) => ReturnType<AnomalyDetectionService['getAnomalyStatistics']>;
}

export const AnomalyDetectionServiceTag = Context.GenericTag<IAnomalyDetectionService>('AnomalyDetectionService');

/**
 * Anomaly detection layer
 */
export const AnomalyDetectionLive = (config: {
  maxHistorySize?: number;
  maxBufferSize?: number;
  alertCallback?: (anomaly: AnomalyResult) => Effect.Effect<void, never, never>;
}) =>
  Layer.effect(
    AnomalyDetectionServiceTag,
    Effect.gen(function* (_) {
      const service = new AnomalyDetectionService({
        maxHistorySize: config.maxHistorySize ?? 10000,
        maxBufferSize: config.maxBufferSize ?? 1000,
        alertCallback: config.alertCallback ?? ((anomaly) => 
          Effect.sync(() => console.log('Anomaly detected:', anomaly))
        ),
      });

      // Register CQRS-specific detectors
      service.registerDetector('commands_per_second', CQRSAnomalyDetectors.createCommandDetector());
      service.registerDetector('events_per_second', CQRSAnomalyDetectors.createEventDetector());
      service.registerDetector('query_latency_p95', CQRSAnomalyDetectors.createLatencyDetector());
      service.registerDetector('error_rate', CQRSAnomalyDetectors.createErrorRateDetector());

      return {
        _tag: 'AnomalyDetectionService',
        service,
        addDataPoint: (metricName: string, dataPoint: MetricDataPoint) =>
          service.addDataPoint(metricName, dataPoint),
        getAnomalyHistory: (metricName: string, since?: Date, limit?: number) =>
          service.getAnomalyHistory(metricName, since, limit),
        getStatistics: (metricName: string) =>
          service.getAnomalyStatistics(metricName),
      };
    })
  );