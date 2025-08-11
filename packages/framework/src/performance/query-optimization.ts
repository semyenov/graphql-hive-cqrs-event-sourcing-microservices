/**
 * Query Optimization Layer
 * 
 * Advanced query optimization for event sourcing:
 * - Query plan generation and caching
 * - Index-based query execution
 * - Materialized view management
 * - Query result caching
 * - Cost-based optimization
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Ref from 'effect/Ref';
import * as Duration from 'effect/Duration';
import * as Cache from 'effect/Cache';
import { pipe } from 'effect/Function';
import type { IEvent } from '../effect/core/types';
import type { AggregateId } from '../core/branded';

/**
 * Query type
 */
export interface Query {
  readonly id: string;
  readonly type: 'stream' | 'aggregate' | 'projection' | 'cross-stream';
  readonly filters: QueryFilter[];
  readonly aggregations?: QueryAggregation[];
  readonly orderBy?: QueryOrder[];
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Query filter
 */
export interface QueryFilter {
  readonly field: string;
  readonly operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  readonly value: any;
}

/**
 * Query aggregation
 */
export interface QueryAggregation {
  readonly type: 'count' | 'sum' | 'avg' | 'min' | 'max';
  readonly field?: string;
  readonly alias: string;
}

/**
 * Query order
 */
export interface QueryOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * Query plan
 */
export interface QueryPlan {
  readonly query: Query;
  readonly steps: QueryStep[];
  readonly estimatedCost: number;
  readonly estimatedRows: number;
  readonly indexes: string[];
  readonly cacheable: boolean;
}

/**
 * Query execution step
 */
export interface QueryStep {
  readonly type: 'scan' | 'index-scan' | 'filter' | 'aggregate' | 'sort' | 'limit';
  readonly description: string;
  readonly cost: number;
  readonly rows: number;
}

/**
 * Query statistics
 */
export interface QueryStats {
  readonly queryId: string;
  readonly executionTime: number;
  readonly rowsScanned: number;
  readonly rowsReturned: number;
  readonly cacheHit: boolean;
  readonly planCost: number;
}

/**
 * Index definition
 */
export interface Index {
  readonly name: string;
  readonly fields: string[];
  readonly unique: boolean;
  readonly sparse: boolean;
  readonly cardinality: number;
}

/**
 * Materialized view
 */
export interface MaterializedView {
  readonly name: string;
  readonly query: Query;
  readonly refreshStrategy: 'immediate' | 'deferred' | 'periodic';
  readonly lastRefresh: Date;
  readonly rowCount: number;
  readonly data: any[];
}

/**
 * Query planner
 */
export class QueryPlanner {
  private planCache = new Map<string, QueryPlan>();
  private statistics = new Map<string, QueryStats[]>();
  
  constructor(
    private readonly indexes: Map<string, Index>,
    private readonly costModel: CostModel
  ) {}
  
  /**
   * Generate query plan
   */
  generatePlan(query: Query): Effect.Effect<QueryPlan, never, never> {
    return Effect.gen(function* (_) {
      // Check cache
      const cached = this.planCache.get(query.id);
      if (cached) {
        return cached;
      }
      
      const steps: QueryStep[] = [];
      let estimatedCost = 0;
      let estimatedRows = 1000; // Default estimate
      const usedIndexes: string[] = [];
      
      // Step 1: Choose access method
      const accessStep = yield* _(this.chooseAccessMethod(query));
      steps.push(accessStep);
      estimatedCost += accessStep.cost;
      estimatedRows = accessStep.rows;
      
      if (accessStep.type === 'index-scan') {
        usedIndexes.push(this.findBestIndex(query.filters)?.name ?? '');
      }
      
      // Step 2: Apply filters
      if (query.filters.length > 0) {
        const filterStep = this.createFilterStep(query.filters, estimatedRows);
        steps.push(filterStep);
        estimatedCost += filterStep.cost;
        estimatedRows = filterStep.rows;
      }
      
      // Step 3: Apply aggregations
      if (query.aggregations && query.aggregations.length > 0) {
        const aggregateStep = this.createAggregateStep(query.aggregations, estimatedRows);
        steps.push(aggregateStep);
        estimatedCost += aggregateStep.cost;
        estimatedRows = Math.min(estimatedRows, 100); // Aggregations reduce rows
      }
      
      // Step 4: Apply sorting
      if (query.orderBy && query.orderBy.length > 0) {
        const sortStep = this.createSortStep(query.orderBy, estimatedRows);
        steps.push(sortStep);
        estimatedCost += sortStep.cost;
      }
      
      // Step 5: Apply limit
      if (query.limit) {
        const limitStep: QueryStep = {
          type: 'limit',
          description: `Limit to ${query.limit} rows`,
          cost: 1,
          rows: Math.min(estimatedRows, query.limit),
        };
        steps.push(limitStep);
        estimatedRows = limitStep.rows;
      }
      
      const plan: QueryPlan = {
        query,
        steps,
        estimatedCost,
        estimatedRows,
        indexes: usedIndexes,
        cacheable: this.isCacheable(query),
      };
      
      // Cache the plan
      this.planCache.set(query.id, plan);
      
      return plan;
    });
  }
  
  /**
   * Choose access method
   */
  private chooseAccessMethod(query: Query): Effect.Effect<QueryStep, never, never> {
    return Effect.gen(function* (_) {
      // Check if we can use an index
      const index = this.findBestIndex(query.filters);
      
      if (index) {
        return {
          type: 'index-scan',
          description: `Index scan using ${index.name}`,
          cost: this.costModel.indexScanCost(index.cardinality),
          rows: Math.floor(index.cardinality * this.estimateSelectivity(query.filters)),
        };
      }
      
      // Fall back to full scan
      return {
        type: 'scan',
        description: 'Sequential scan',
        cost: this.costModel.sequentialScanCost(10000), // Assume 10k rows
        rows: 10000,
      };
    });
  }
  
  /**
   * Find best index for filters
   */
  private findBestIndex(filters: QueryFilter[]): Index | undefined {
    let bestIndex: Index | undefined;
    let bestScore = 0;
    
    for (const [_, index] of this.indexes) {
      const score = this.scoreIndex(index, filters);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    
    return bestIndex;
  }
  
  /**
   * Score index for filters
   */
  private scoreIndex(index: Index, filters: QueryFilter[]): number {
    let score = 0;
    const filterFields = new Set(filters.map(f => f.field));
    
    // Check how many index fields match filters
    for (let i = 0; i < index.fields.length; i++) {
      if (filterFields.has(index.fields[i])) {
        score += (index.fields.length - i); // Earlier fields score higher
      } else {
        break; // Index prefix must match
      }
    }
    
    // Bonus for unique indexes
    if (index.unique) {
      score *= 2;
    }
    
    return score;
  }
  
  /**
   * Estimate selectivity
   */
  private estimateSelectivity(filters: QueryFilter[]): number {
    let selectivity = 1.0;
    
    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          selectivity *= 0.01; // 1% selectivity for equality
          break;
        case 'in':
          selectivity *= 0.1; // 10% for IN
          break;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
          selectivity *= 0.3; // 30% for range
          break;
        case 'like':
          selectivity *= 0.5; // 50% for LIKE
          break;
        default:
          selectivity *= 0.5;
      }
    }
    
    return Math.max(selectivity, 0.001); // At least 0.1%
  }
  
  /**
   * Create filter step
   */
  private createFilterStep(filters: QueryFilter[], inputRows: number): QueryStep {
    const selectivity = this.estimateSelectivity(filters);
    return {
      type: 'filter',
      description: `Filter on ${filters.map(f => f.field).join(', ')}`,
      cost: this.costModel.filterCost(inputRows),
      rows: Math.floor(inputRows * selectivity),
    };
  }
  
  /**
   * Create aggregate step
   */
  private createAggregateStep(aggregations: QueryAggregation[], inputRows: number): QueryStep {
    return {
      type: 'aggregate',
      description: `Aggregate: ${aggregations.map(a => a.type).join(', ')}`,
      cost: this.costModel.aggregateCost(inputRows),
      rows: Math.min(inputRows, 100), // Aggregation reduces rows significantly
    };
  }
  
  /**
   * Create sort step
   */
  private createSortStep(orderBy: QueryOrder[], inputRows: number): QueryStep {
    return {
      type: 'sort',
      description: `Sort by ${orderBy.map(o => o.field).join(', ')}`,
      cost: this.costModel.sortCost(inputRows),
      rows: inputRows,
    };
  }
  
  /**
   * Check if query is cacheable
   */
  private isCacheable(query: Query): boolean {
    // Don't cache queries with non-deterministic filters
    for (const filter of query.filters) {
      if (filter.field === 'timestamp' || filter.field === 'random') {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Explain query plan
   */
  explainPlan(plan: QueryPlan): string {
    const lines: string[] = [];
    lines.push('Query Execution Plan');
    lines.push('=' .repeat(50));
    lines.push(`Estimated Cost: ${plan.estimatedCost.toFixed(2)}`);
    lines.push(`Estimated Rows: ${plan.estimatedRows}`);
    
    if (plan.indexes.length > 0) {
      lines.push(`Indexes Used: ${plan.indexes.join(', ')}`);
    }
    
    lines.push('\nExecution Steps:');
    for (const [i, step] of plan.steps.entries()) {
      lines.push(`  ${i + 1}. ${step.description}`);
      lines.push(`     Type: ${step.type}`);
      lines.push(`     Cost: ${step.cost.toFixed(2)}`);
      lines.push(`     Rows: ${step.rows}`);
    }
    
    if (plan.cacheable) {
      lines.push('\n✓ This query result can be cached');
    }
    
    return lines.join('\n');
  }
}

/**
 * Cost model for query operations
 */
export class CostModel {
  constructor(
    private readonly config: {
      seqPageCost: number; // Cost to read a page sequentially
      randomPageCost: number; // Cost to read a page randomly
      cpuTupleCost: number; // CPU cost per tuple
      cpuOperatorCost: number; // CPU cost per operator
    } = {
      seqPageCost: 1.0,
      randomPageCost: 4.0,
      cpuTupleCost: 0.01,
      cpuOperatorCost: 0.0025,
    }
  ) {}
  
  /**
   * Sequential scan cost
   */
  sequentialScanCost(rows: number): number {
    const pages = Math.ceil(rows / 100); // Assume 100 rows per page
    return pages * this.config.seqPageCost + rows * this.config.cpuTupleCost;
  }
  
  /**
   * Index scan cost
   */
  indexScanCost(rows: number): number {
    const pages = Math.ceil(rows / 100);
    return pages * this.config.randomPageCost + rows * this.config.cpuTupleCost;
  }
  
  /**
   * Filter cost
   */
  filterCost(rows: number): number {
    return rows * this.config.cpuOperatorCost;
  }
  
  /**
   * Sort cost
   */
  sortCost(rows: number): number {
    // O(n log n) cost
    return rows * Math.log2(rows) * this.config.cpuOperatorCost;
  }
  
  /**
   * Aggregate cost
   */
  aggregateCost(rows: number): number {
    return rows * this.config.cpuOperatorCost * 2; // Aggregations are more expensive
  }
}

/**
 * Query executor
 */
export class QueryExecutor {
  private resultCache: Cache.Cache<any, never, never>;
  private stats: QueryStats[] = [];
  
  constructor(
    private readonly planner: QueryPlanner,
    private readonly dataSource: {
      scan: (filter?: QueryFilter[]) => Effect.Effect<any[], never, never>;
      indexScan: (index: string, filter: QueryFilter[]) => Effect.Effect<any[], never, never>;
    }
  ) {
    this.resultCache = Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(5),
      lookup: (key: string) => this.executeUncached(JSON.parse(key)),
    });
  }
  
  /**
   * Execute query
   */
  execute(query: Query): Effect.Effect<any[], never, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      // Check cache if query is cacheable
      const plan = yield* _(this.planner.generatePlan(query));
      
      let result: any[];
      let cacheHit = false;
      
      if (plan.cacheable) {
        const cached = yield* _(
          Cache.get(this.resultCache, JSON.stringify(query))
        );
        if (cached) {
          result = cached;
          cacheHit = true;
        } else {
          result = yield* _(this.executeWithPlan(query, plan));
          yield* _(Cache.set(this.resultCache, JSON.stringify(query), result));
        }
      } else {
        result = yield* _(this.executeWithPlan(query, plan));
      }
      
      // Record statistics
      const stats: QueryStats = {
        queryId: query.id,
        executionTime: Date.now() - startTime,
        rowsScanned: plan.estimatedRows * 2, // Rough estimate
        rowsReturned: result.length,
        cacheHit,
        planCost: plan.estimatedCost,
      };
      
      this.stats.push(stats);
      
      return result;
    });
  }
  
  /**
   * Execute uncached query
   */
  private executeUncached(query: Query): Effect.Effect<any[], never, never> {
    return Effect.gen(function* (_) {
      const plan = yield* _(this.planner.generatePlan(query));
      return yield* _(this.executeWithPlan(query, plan));
    });
  }
  
  /**
   * Execute with plan
   */
  private executeWithPlan(
    query: Query,
    plan: QueryPlan
  ): Effect.Effect<any[], never, never> {
    return Effect.gen(function* (_) {
      let data: any[] = [];
      
      for (const step of plan.steps) {
        switch (step.type) {
          case 'scan':
            data = yield* _(this.dataSource.scan());
            break;
          case 'index-scan':
            const indexName = plan.indexes[0];
            data = yield* _(this.dataSource.indexScan(indexName, query.filters));
            break;
          case 'filter':
            data = this.applyFilters(data, query.filters);
            break;
          case 'aggregate':
            data = this.applyAggregations(data, query.aggregations!);
            break;
          case 'sort':
            data = this.applySort(data, query.orderBy!);
            break;
          case 'limit':
            data = data.slice(query.offset ?? 0, (query.offset ?? 0) + query.limit!);
            break;
        }
      }
      
      return data;
    });
  }
  
  /**
   * Apply filters
   */
  private applyFilters(data: any[], filters: QueryFilter[]): any[] {
    return data.filter(row => {
      for (const filter of filters) {
        const value = row[filter.field];
        
        switch (filter.operator) {
          case 'eq':
            if (value !== filter.value) return false;
            break;
          case 'ne':
            if (value === filter.value) return false;
            break;
          case 'gt':
            if (value <= filter.value) return false;
            break;
          case 'gte':
            if (value < filter.value) return false;
            break;
          case 'lt':
            if (value >= filter.value) return false;
            break;
          case 'lte':
            if (value > filter.value) return false;
            break;
          case 'in':
            if (!filter.value.includes(value)) return false;
            break;
          case 'like':
            if (!value.includes(filter.value)) return false;
            break;
        }
      }
      return true;
    });
  }
  
  /**
   * Apply aggregations
   */
  private applyAggregations(data: any[], aggregations: QueryAggregation[]): any[] {
    const result: any = {};
    
    for (const agg of aggregations) {
      switch (agg.type) {
        case 'count':
          result[agg.alias] = data.length;
          break;
        case 'sum':
          result[agg.alias] = data.reduce((sum, row) => sum + (row[agg.field!] ?? 0), 0);
          break;
        case 'avg':
          const sum = data.reduce((s, row) => s + (row[agg.field!] ?? 0), 0);
          result[agg.alias] = data.length > 0 ? sum / data.length : 0;
          break;
        case 'min':
          result[agg.alias] = Math.min(...data.map(row => row[agg.field!] ?? Infinity));
          break;
        case 'max':
          result[agg.alias] = Math.max(...data.map(row => row[agg.field!] ?? -Infinity));
          break;
      }
    }
    
    return [result];
  }
  
  /**
   * Apply sorting
   */
  private applySort(data: any[], orderBy: QueryOrder[]): any[] {
    return [...data].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.field];
        const bVal = b[order.field];
        
        if (aVal < bVal) return order.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return order.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  /**
   * Get query statistics
   */
  getStatistics(): QueryStats[] {
    return [...this.stats];
  }
}

/**
 * Materialized view manager
 */
export class MaterializedViewManager {
  private views = new Map<string, MaterializedView>();
  private refreshQueue: Array<string> = [];
  
  constructor(
    private readonly executor: QueryExecutor
  ) {}
  
  /**
   * Create materialized view
   */
  createView(
    name: string,
    query: Query,
    refreshStrategy: MaterializedView['refreshStrategy'] = 'deferred'
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const data = yield* _(this.executor.execute(query));
      
      const view: MaterializedView = {
        name,
        query,
        refreshStrategy,
        lastRefresh: new Date(),
        rowCount: data.length,
        data,
      };
      
      this.views.set(name, view);
      
      if (refreshStrategy === 'immediate') {
        this.refreshQueue.push(name);
      }
    });
  }
  
  /**
   * Query view
   */
  queryView(name: string): Effect.Effect<any[], Error, never> {
    return Effect.gen(function* (_) {
      const view = this.views.get(name);
      if (!view) {
        return yield* _(Effect.fail(new Error(`View not found: ${name}`)));
      }
      
      // Check if refresh needed
      if (this.needsRefresh(view)) {
        yield* _(this.refreshView(name));
      }
      
      return view.data;
    });
  }
  
  /**
   * Refresh view
   */
  refreshView(name: string): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      const view = this.views.get(name);
      if (!view) return;
      
      const data = yield* _(this.executor.execute(view.query));
      
      view.data = data;
      view.rowCount = data.length;
      view.lastRefresh = new Date();
    });
  }
  
  /**
   * Check if view needs refresh
   */
  private needsRefresh(view: MaterializedView): boolean {
    if (view.refreshStrategy === 'immediate') {
      return false; // Always fresh
    }
    
    if (view.refreshStrategy === 'periodic') {
      const age = Date.now() - view.lastRefresh.getTime();
      return age > 60000; // Refresh every minute
    }
    
    return false; // Deferred views refresh on demand
  }
  
  /**
   * Process refresh queue
   */
  processRefreshQueue(): Effect.Effect<void, never, never> {
    return Effect.gen(function* (_) {
      while (this.refreshQueue.length > 0) {
        const name = this.refreshQueue.shift()!;
        yield* _(this.refreshView(name));
      }
    });
  }
}

/**
 * Create query optimizer
 */
export const createQueryOptimizer = (
  indexes: Index[] = []
): {
  planner: QueryPlanner;
  executor: QueryExecutor;
  viewManager: MaterializedViewManager;
} => {
  const indexMap = new Map<string, Index>();
  for (const index of indexes) {
    indexMap.set(index.name, index);
  }
  
  const planner = new QueryPlanner(indexMap, new CostModel());
  
  const dataSource = {
    scan: () => Effect.succeed([]), // Mock implementation
    indexScan: () => Effect.succeed([]), // Mock implementation
  };
  
  const executor = new QueryExecutor(planner, dataSource);
  const viewManager = new MaterializedViewManager(executor);
  
  return {
    planner,
    executor,
    viewManager,
  };
};