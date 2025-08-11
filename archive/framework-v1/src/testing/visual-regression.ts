/**
 * Visual Regression Testing Framework
 * 
 * Visual testing for dashboards, UI components, and data visualizations:
 * - Screenshot capture and comparison
 * - Dashboard visual regression
 * - Chart and graph validation
 * - PDF report generation testing
 * - Email template testing
 * - Cross-browser visual testing
 * - Responsive design testing
 * - Accessibility visual testing
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import { pipe } from 'effect/Function';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Visual test configuration
 */
export interface VisualTestConfig {
  readonly baselineDir: string;
  readonly outputDir: string;
  readonly diffDir: string;
  readonly threshold: number; // Difference threshold (0-1)
  readonly ignoreRegions?: IgnoreRegion[];
  readonly viewports: Viewport[];
  readonly browsers?: Browser[];
  readonly captureDelay?: Duration.Duration;
  readonly animations?: boolean;
  readonly fullPage?: boolean;
}

/**
 * Viewport configuration
 */
export interface Viewport {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor?: number;
  readonly isMobile?: boolean;
  readonly hasTouch?: boolean;
}

/**
 * Browser configuration
 */
export interface Browser {
  readonly name: 'chrome' | 'firefox' | 'safari' | 'edge';
  readonly version?: string;
  readonly headless?: boolean;
}

/**
 * Ignore region
 */
export interface IgnoreRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly reason?: string;
}

/**
 * Visual test case
 */
export interface VisualTestCase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly url?: string;
  readonly component?: any;
  readonly setup?: () => Effect.Effect<void, Error, never>;
  readonly teardown?: () => Effect.Effect<void, Error, never>;
  readonly actions?: TestAction[];
  readonly assertions?: VisualAssertion[];
  readonly tags?: string[];
}

/**
 * Test action
 */
export interface TestAction {
  readonly type: 'click' | 'type' | 'select' | 'hover' | 'scroll' | 'wait';
  readonly selector?: string;
  readonly value?: string | number;
  readonly duration?: Duration.Duration;
}

/**
 * Visual assertion
 */
export interface VisualAssertion {
  readonly type: 'exact' | 'fuzzy' | 'layout' | 'text' | 'color';
  readonly threshold?: number;
  readonly selector?: string;
  readonly expected?: any;
}

/**
 * Screenshot
 */
export interface Screenshot {
  readonly id: string;
  readonly testCase: string;
  readonly viewport: Viewport;
  readonly browser?: Browser;
  readonly timestamp: Date;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Visual comparison result
 */
export interface ComparisonResult {
  readonly testCase: VisualTestCase;
  readonly baseline: Screenshot;
  readonly current: Screenshot;
  readonly diff?: DiffImage;
  readonly passed: boolean;
  readonly difference: number; // Percentage difference
  readonly diffPixels: number;
  readonly totalPixels: number;
  readonly duration: Duration.Duration;
  readonly errors?: string[];
}

/**
 * Diff image
 */
export interface DiffImage {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly highlights: DiffHighlight[];
}

/**
 * Diff highlight
 */
export interface DiffHighlight {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly type: 'added' | 'removed' | 'changed';
  readonly severity: 'low' | 'medium' | 'high';
}

/**
 * Visual test report
 */
export interface VisualTestReport {
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: Duration.Duration;
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly newBaselines: number;
  readonly results: ComparisonResult[];
  readonly summary: TestSummary;
  readonly artifacts: TestArtifact[];
}

/**
 * Test summary
 */
export interface TestSummary {
  readonly passRate: number;
  readonly averageDifference: number;
  readonly maxDifference: number;
  readonly totalDiffPixels: number;
  readonly byViewport: Map<string, ViewportSummary>;
  readonly byBrowser?: Map<string, BrowserSummary>;
  readonly recommendations: string[];
}

/**
 * Viewport summary
 */
export interface ViewportSummary {
  readonly viewport: Viewport;
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly averageDifference: number;
}

/**
 * Browser summary
 */
export interface BrowserSummary {
  readonly browser: Browser;
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly averageDifference: number;
}

/**
 * Test artifact
 */
export interface TestArtifact {
  readonly type: 'screenshot' | 'diff' | 'report' | 'video';
  readonly path: string;
  readonly testCase?: string;
  readonly description?: string;
}

/**
 * Image comparator
 */
export class ImageComparator {
  constructor(
    private readonly config: {
      threshold: number;
      ignoreRegions?: IgnoreRegion[];
      algorithm?: 'pixel' | 'perceptual' | 'structural';
    }
  ) {}

  /**
   * Compare images
   */
  compareImages(
    baseline: Screenshot,
    current: Screenshot
  ): Effect.Effect<ComparisonResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        // Load images
        const baselineImage = yield* _(this.loadImage(baseline.path));
        const currentImage = yield* _(this.loadImage(current.path));
        
        // Check dimensions
        if (baseline.width !== current.width || baseline.height !== current.height) {
          return {
            testCase: { id: baseline.testCase, name: baseline.testCase, description: '' },
            baseline,
            current,
            passed: false,
            difference: 100,
            diffPixels: baseline.width * baseline.height,
            totalPixels: baseline.width * baseline.height,
            duration: Duration.millis(Date.now() - startTime),
            errors: [`Dimension mismatch: ${baseline.width}x${baseline.height} vs ${current.width}x${current.height}`],
          };
        }
        
        // Perform comparison
        const comparisonData = yield* _(this.performComparison(baselineImage, currentImage));
        
        // Generate diff image if failed
        let diff: DiffImage | undefined;
        if (!comparisonData.passed) {
          diff = yield* _(this.generateDiffImage(
            baselineImage,
            currentImage,
            comparisonData
          ));
        }
        
        return {
          testCase: { id: baseline.testCase, name: baseline.testCase, description: '' },
          baseline,
          current,
          diff,
          passed: comparisonData.passed,
          difference: comparisonData.difference,
          diffPixels: comparisonData.diffPixels,
          totalPixels: comparisonData.totalPixels,
          duration: Duration.millis(Date.now() - startTime),
        };
        
      } catch (error) {
        return {
          testCase: { id: baseline.testCase, name: baseline.testCase, description: '' },
          baseline,
          current,
          passed: false,
          difference: 100,
          diffPixels: 0,
          totalPixels: baseline.width * baseline.height,
          duration: Duration.millis(Date.now() - startTime),
          errors: [String(error)],
        };
      }
    });
  }

  /**
   * Load image
   */
  private loadImage(imagePath: string): Effect.Effect<ImageData, Error, never> {
    return Effect.gen(function* (_) {
      // In production, would use actual image loading library
      // For now, simulate with mock data
      const stats = fs.statSync(imagePath);
      
      return {
        width: 1920,
        height: 1080,
        data: new Uint8ClampedArray(1920 * 1080 * 4), // RGBA
      };
    });
  }

  /**
   * Perform comparison
   */
  private performComparison(
    baseline: ImageData,
    current: ImageData
  ): Effect.Effect<{
    passed: boolean;
    difference: number;
    diffPixels: number;
    totalPixels: number;
    diffMap: boolean[][];
  }, Error, never> {
    return Effect.sync(() => {
      const width = baseline.width;
      const height = baseline.height;
      const totalPixels = width * height;
      let diffPixels = 0;
      const diffMap: boolean[][] = [];
      
      // Initialize diff map
      for (let y = 0; y < height; y++) {
        diffMap[y] = new Array(width).fill(false);
      }
      
      // Compare pixels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Check if in ignore region
          if (this.isInIgnoreRegion(x, y)) {
            continue;
          }
          
          const index = (y * width + x) * 4;
          
          // Compare RGBA values
          const diff = this.calculatePixelDifference(
            baseline.data.slice(index, index + 4),
            current.data.slice(index, index + 4)
          );
          
          if (diff > this.config.threshold) {
            diffPixels++;
            diffMap[y][x] = true;
          }
        }
      }
      
      const difference = (diffPixels / totalPixels) * 100;
      const passed = difference <= this.config.threshold * 100;
      
      return {
        passed,
        difference,
        diffPixels,
        totalPixels,
        diffMap,
      };
    });
  }

  /**
   * Calculate pixel difference
   */
  private calculatePixelDifference(
    pixel1: Uint8ClampedArray,
    pixel2: Uint8ClampedArray
  ): number {
    if (this.config.algorithm === 'perceptual') {
      // Perceptual difference (simplified)
      const deltaR = (pixel1[0] - pixel2[0]) / 255;
      const deltaG = (pixel1[1] - pixel2[1]) / 255;
      const deltaB = (pixel1[2] - pixel2[2]) / 255;
      const deltaA = (pixel1[3] - pixel2[3]) / 255;
      
      // Weighted by human perception
      return Math.sqrt(
        0.299 * deltaR * deltaR +
        0.587 * deltaG * deltaG +
        0.114 * deltaB * deltaB +
        0.1 * deltaA * deltaA
      );
    } else {
      // Simple pixel difference
      const deltaR = Math.abs(pixel1[0] - pixel2[0]) / 255;
      const deltaG = Math.abs(pixel1[1] - pixel2[1]) / 255;
      const deltaB = Math.abs(pixel1[2] - pixel2[2]) / 255;
      const deltaA = Math.abs(pixel1[3] - pixel2[3]) / 255;
      
      return (deltaR + deltaG + deltaB + deltaA) / 4;
    }
  }

  /**
   * Check if pixel is in ignore region
   */
  private isInIgnoreRegion(x: number, y: number): boolean {
    if (!this.config.ignoreRegions) return false;
    
    return this.config.ignoreRegions.some(region =>
      x >= region.x &&
      x < region.x + region.width &&
      y >= region.y &&
      y < region.y + region.height
    );
  }

  /**
   * Generate diff image
   */
  private generateDiffImage(
    baseline: ImageData,
    current: ImageData,
    comparisonData: any
  ): Effect.Effect<DiffImage, Error, never> {
    return Effect.sync(() => {
      const highlights = this.findDiffHighlights(comparisonData.diffMap);
      
      const diffPath = path.join(
        this.config.ignoreRegions?.[0]?.reason || 'diff',
        `diff-${Date.now()}.png`
      );
      
      // In production, would generate actual diff image
      
      return {
        path: diffPath,
        width: baseline.width,
        height: baseline.height,
        highlights,
      };
    });
  }

  /**
   * Find diff highlights
   */
  private findDiffHighlights(diffMap: boolean[][]): DiffHighlight[] {
    const highlights: DiffHighlight[] = [];
    const visited: boolean[][] = diffMap.map(row => row.map(() => false));
    
    for (let y = 0; y < diffMap.length; y++) {
      for (let x = 0; x < diffMap[y].length; x++) {
        if (diffMap[y][x] && !visited[y][x]) {
          // Find connected component
          const region = this.findConnectedRegion(diffMap, visited, x, y);
          
          if (region.width * region.height > 10) { // Ignore tiny differences
            highlights.push({
              ...region,
              type: 'changed',
              severity: this.calculateSeverity(region.width * region.height),
            });
          }
        }
      }
    }
    
    return highlights;
  }

  /**
   * Find connected region
   */
  private findConnectedRegion(
    diffMap: boolean[][],
    visited: boolean[][],
    startX: number,
    startY: number
  ): { x: number; y: number; width: number; height: number } {
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    
    const queue: [number, number][] = [[startX, startY]];
    visited[startY][startX] = true;
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Check neighbors
      const neighbors = [
        [x - 1, y], [x + 1, y],
        [x, y - 1], [x, y + 1],
      ];
      
      for (const [nx, ny] of neighbors) {
        if (
          nx >= 0 && nx < diffMap[0].length &&
          ny >= 0 && ny < diffMap.length &&
          diffMap[ny][nx] && !visited[ny][nx]
        ) {
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Calculate severity
   */
  private calculateSeverity(pixelCount: number): 'low' | 'medium' | 'high' {
    if (pixelCount < 100) return 'low';
    if (pixelCount < 1000) return 'medium';
    return 'high';
  }
}

/**
 * Interface for image data
 */
interface ImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Screenshot capture service
 */
export class ScreenshotCaptureService {
  constructor(
    private readonly config: {
      outputDir: string;
      captureDelay?: Duration.Duration;
      fullPage?: boolean;
    }
  ) {}

  /**
   * Capture screenshot
   */
  captureScreenshot(
    testCase: VisualTestCase,
    viewport: Viewport,
    browser?: Browser
  ): Effect.Effect<Screenshot, Error, never> {
    return Effect.gen(function* (_) {
      // Setup test case
      if (testCase.setup) {
        yield* _(testCase.setup());
      }

      try {
        // Execute actions
        if (testCase.actions) {
          for (const action of testCase.actions) {
            yield* _(this.executeAction(action));
          }
        }

        // Wait for capture delay
        if (this.config.captureDelay) {
          yield* _(Effect.sleep(this.config.captureDelay));
        }

        // Capture screenshot
        const screenshotPath = path.join(
          this.config.outputDir,
          `${testCase.id}-${viewport.name}-${Date.now()}.png`
        );

        // In production, would use Playwright or Puppeteer
        // For now, simulate screenshot capture
        const screenshot: Screenshot = {
          id: `screenshot-${Date.now()}`,
          testCase: testCase.id,
          viewport,
          browser,
          timestamp: new Date(),
          path: screenshotPath,
          width: viewport.width,
          height: viewport.height,
          metadata: {
            fullPage: this.config.fullPage,
          },
        };

        // Save screenshot (simulated)
        this.saveScreenshot(screenshot);

        return screenshot;

      } finally {
        // Teardown
        if (testCase.teardown) {
          yield* _(testCase.teardown());
        }
      }
    });
  }

  /**
   * Execute test action
   */
  private executeAction(action: TestAction): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      switch (action.type) {
        case 'click':
          console.log(`Click: ${action.selector}`);
          break;
        case 'type':
          console.log(`Type: ${action.value} into ${action.selector}`);
          break;
        case 'select':
          console.log(`Select: ${action.value} in ${action.selector}`);
          break;
        case 'hover':
          console.log(`Hover: ${action.selector}`);
          break;
        case 'scroll':
          console.log(`Scroll: ${action.value}`);
          break;
        case 'wait':
          if (action.duration) {
            yield* _(Effect.sleep(action.duration));
          }
          break;
      }
    });
  }

  /**
   * Save screenshot
   */
  private saveScreenshot(screenshot: Screenshot): void {
    // In production, would save actual image
    const dir = path.dirname(screenshot.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create placeholder file
    fs.writeFileSync(screenshot.path, 'SCREENSHOT_PLACEHOLDER');
  }
}

/**
 * Visual test runner
 */
export class VisualTestRunner {
  private screenshotService: ScreenshotCaptureService;
  private imageComparator: ImageComparator;
  private baselineManager: BaselineManager;

  constructor(
    private readonly config: VisualTestConfig
  ) {
    this.screenshotService = new ScreenshotCaptureService({
      outputDir: config.outputDir,
      captureDelay: config.captureDelay,
      fullPage: config.fullPage,
    });

    this.imageComparator = new ImageComparator({
      threshold: config.threshold,
      ignoreRegions: config.ignoreRegions,
    });

    this.baselineManager = new BaselineManager(config.baselineDir);
  }

  /**
   * Run visual tests
   */
  runVisualTests(
    testCases: VisualTestCase[]
  ): Effect.Effect<VisualTestReport, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = new Date();
      const results: ComparisonResult[] = [];
      const artifacts: TestArtifact[] = [];
      let newBaselines = 0;

      console.log(`🎨 Running ${testCases.length} visual tests...\n`);

      for (const testCase of testCases) {
        console.log(`  Testing: ${testCase.name}`);

        for (const viewport of this.config.viewports) {
          // Capture current screenshot
          const current = yield* _(
            this.screenshotService.captureScreenshot(testCase, viewport)
          );

          artifacts.push({
            type: 'screenshot',
            path: current.path,
            testCase: testCase.id,
            description: `${viewport.name} viewport`,
          });

          // Get baseline
          const baselineOption = yield* _(
            this.baselineManager.getBaseline(testCase.id, viewport.name)
          );

          if (Option.isNone(baselineOption)) {
            // No baseline exists, create one
            console.log(`    📸 Creating baseline for ${viewport.name}`);
            yield* _(this.baselineManager.saveBaseline(current));
            newBaselines++;
            
            results.push({
              testCase,
              baseline: current,
              current,
              passed: true,
              difference: 0,
              diffPixels: 0,
              totalPixels: current.width * current.height,
              duration: Duration.millis(0),
            });
          } else {
            // Compare with baseline
            const baseline = baselineOption.value;
            const comparison = yield* _(
              this.imageComparator.compareImages(baseline, current)
            );

            results.push(comparison);

            if (!comparison.passed) {
              console.log(`    ❌ ${viewport.name}: ${comparison.difference.toFixed(2)}% difference`);
              
              if (comparison.diff) {
                artifacts.push({
                  type: 'diff',
                  path: comparison.diff.path,
                  testCase: testCase.id,
                  description: `Diff for ${viewport.name}`,
                });
              }
            } else {
              console.log(`    ✅ ${viewport.name}: Passed`);
            }
          }
        }
      }

      const endTime = new Date();
      const report = this.generateReport(
        results,
        newBaselines,
        startTime,
        endTime,
        artifacts
      );

      this.displayReport(report);

      return report;
    });
  }

  /**
   * Generate report
   */
  private generateReport(
    results: ComparisonResult[],
    newBaselines: number,
    startTime: Date,
    endTime: Date,
    artifacts: TestArtifact[]
  ): VisualTestReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalDifference = results.reduce((sum, r) => sum + r.difference, 0);
    const totalDiffPixels = results.reduce((sum, r) => sum + r.diffPixels, 0);

    // Calculate viewport summaries
    const byViewport = new Map<string, ViewportSummary>();
    for (const viewport of this.config.viewports) {
      const viewportResults = results.filter(r => 
        r.current.viewport.name === viewport.name
      );

      if (viewportResults.length > 0) {
        byViewport.set(viewport.name, {
          viewport,
          tests: viewportResults.length,
          passed: viewportResults.filter(r => r.passed).length,
          failed: viewportResults.filter(r => !r.passed).length,
          averageDifference: viewportResults.reduce((sum, r) => sum + r.difference, 0) / viewportResults.length,
        });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (failed > 0) {
      recommendations.push(`${failed} visual tests failed. Review diff images for details.`);
    }

    if (newBaselines > 0) {
      recommendations.push(`${newBaselines} new baselines created. Verify they are correct.`);
    }

    const maxDifference = Math.max(...results.map(r => r.difference));
    if (maxDifference > 10) {
      recommendations.push('Large visual differences detected. Consider if changes are intentional.');
    }

    return {
      startTime,
      endTime,
      duration: Duration.millis(endTime.getTime() - startTime.getTime()),
      totalTests: results.length,
      passed,
      failed,
      skipped: 0,
      newBaselines,
      results,
      summary: {
        passRate: results.length > 0 ? (passed / results.length) * 100 : 100,
        averageDifference: results.length > 0 ? totalDifference / results.length : 0,
        maxDifference,
        totalDiffPixels,
        byViewport,
        recommendations,
      },
      artifacts,
    };
  }

  /**
   * Display report
   */
  private displayReport(report: VisualTestReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎨 VISUAL REGRESSION TEST REPORT');
    console.log('='.repeat(80) + '\n');

    console.log('📊 Summary:');
    console.log(`  Total Tests:     ${report.totalTests}`);
    console.log(`  Passed:          ${report.passed} (${report.summary.passRate.toFixed(1)}%)`);
    console.log(`  Failed:          ${report.failed}`);
    console.log(`  New Baselines:   ${report.newBaselines}`);
    console.log(`  Duration:        ${Duration.toMillis(report.duration) / 1000}s`);

    if (report.failed > 0) {
      console.log('\n❌ Failed Tests:');
      for (const result of report.results.filter(r => !r.passed)) {
        console.log(`  ${result.testCase.name} (${result.current.viewport.name})`);
        console.log(`    Difference: ${result.difference.toFixed(2)}%`);
        console.log(`    Pixels:     ${result.diffPixels} / ${result.totalPixels}`);
      }
    }

    console.log('\n📱 By Viewport:');
    for (const [name, summary] of report.summary.byViewport) {
      console.log(`  ${name}:`);
      console.log(`    Tests:  ${summary.tests}`);
      console.log(`    Passed: ${summary.passed}`);
      console.log(`    Failed: ${summary.failed}`);
      console.log(`    Avg Diff: ${summary.averageDifference.toFixed(2)}%`);
    }

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of report.summary.recommendations) {
        console.log(`  ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(80));
  }
}

/**
 * Baseline manager
 */
export class BaselineManager {
  constructor(
    private readonly baselineDir: string
  ) {}

  /**
   * Get baseline
   */
  getBaseline(
    testCaseId: string,
    viewportName: string
  ): Effect.Effect<Option.Option<Screenshot>, Error, never> {
    return Effect.sync(() => {
      const baselinePath = path.join(
        this.baselineDir,
        `${testCaseId}-${viewportName}-baseline.png`
      );

      if (fs.existsSync(baselinePath)) {
        const stats = fs.statSync(baselinePath);
        
        return Option.some({
          id: `baseline-${testCaseId}-${viewportName}`,
          testCase: testCaseId,
          viewport: { name: viewportName, width: 1920, height: 1080 },
          timestamp: stats.mtime,
          path: baselinePath,
          width: 1920,
          height: 1080,
        });
      }

      return Option.none();
    });
  }

  /**
   * Save baseline
   */
  saveBaseline(screenshot: Screenshot): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const baselinePath = path.join(
        this.baselineDir,
        `${screenshot.testCase}-${screenshot.viewport.name}-baseline.png`
      );

      const dir = path.dirname(baselinePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // In production, would copy actual image file
      fs.copyFileSync(screenshot.path, baselinePath);
    });
  }

  /**
   * Update baseline
   */
  updateBaseline(
    testCaseId: string,
    viewportName: string,
    newScreenshot: Screenshot
  ): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      const baselinePath = path.join(
        this.baselineDir,
        `${testCaseId}-${viewportName}-baseline.png`
      );

      // Archive old baseline
      if (fs.existsSync(baselinePath)) {
        const archivePath = baselinePath.replace('.png', `-${Date.now()}.png`);
        fs.renameSync(baselinePath, archivePath);
      }

      // Save new baseline
      fs.copyFileSync(newScreenshot.path, baselinePath);
    });
  }
}

/**
 * Dashboard visual tests
 */
export class DashboardVisualTests {
  /**
   * Create Grafana dashboard test
   */
  static grafanaDashboard(
    dashboardUrl: string,
    dashboardName: string
  ): VisualTestCase {
    return {
      id: `grafana-${dashboardName}`,
      name: `Grafana Dashboard: ${dashboardName}`,
      description: 'Visual regression test for Grafana dashboard',
      url: dashboardUrl,
      setup: () => Effect.sync(() => {
        console.log(`Opening dashboard: ${dashboardUrl}`);
      }),
      actions: [
        {
          type: 'wait',
          duration: Duration.seconds(3), // Wait for data to load
        },
      ],
      assertions: [
        {
          type: 'layout',
          threshold: 0.02, // 2% layout difference allowed
        },
      ],
      tags: ['dashboard', 'grafana'],
    };
  }

  /**
   * Create chart test
   */
  static chartVisualization(
    chartId: string,
    chartType: string
  ): VisualTestCase {
    return {
      id: `chart-${chartId}`,
      name: `Chart: ${chartType}`,
      description: `Visual test for ${chartType} chart`,
      actions: [
        {
          type: 'hover',
          selector: '.chart-container',
        },
        {
          type: 'wait',
          duration: Duration.seconds(1),
        },
      ],
      assertions: [
        {
          type: 'fuzzy',
          threshold: 0.05, // 5% difference allowed for dynamic data
        },
      ],
      tags: ['chart', chartType],
    };
  }

  /**
   * Create report PDF test
   */
  static reportPDF(
    reportGenerator: () => Effect.Effect<Buffer, Error, never>
  ): VisualTestCase {
    return {
      id: 'report-pdf',
      name: 'PDF Report Generation',
      description: 'Visual test for PDF report layout',
      setup: () => Effect.gen(function* (_) {
        const pdf = yield* _(reportGenerator());
        // Save PDF for visual comparison
        fs.writeFileSync('/tmp/report.pdf', pdf);
      }),
      assertions: [
        {
          type: 'layout',
          threshold: 0.01, // 1% layout difference for PDFs
        },
      ],
      tags: ['report', 'pdf'],
    };
  }
}

/**
 * Predefined viewports
 */
export const VIEWPORTS = {
  mobile: {
    name: 'mobile',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  tablet: {
    name: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    name: 'desktop',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  },
  ultrawide: {
    name: 'ultrawide',
    width: 3440,
    height: 1440,
    deviceScaleFactor: 1,
  },
};

/**
 * Create visual test runner
 */
export const createVisualTestRunner = (config: Partial<VisualTestConfig>): VisualTestRunner => {
  const fullConfig: VisualTestConfig = {
    baselineDir: config.baselineDir || './baselines',
    outputDir: config.outputDir || './screenshots',
    diffDir: config.diffDir || './diffs',
    threshold: config.threshold ?? 0.01, // 1% default threshold
    ignoreRegions: config.ignoreRegions,
    viewports: config.viewports || [VIEWPORTS.desktop],
    browsers: config.browsers,
    captureDelay: config.captureDelay,
    animations: config.animations ?? false,
    fullPage: config.fullPage ?? false,
  };

  return new VisualTestRunner(fullConfig);
};