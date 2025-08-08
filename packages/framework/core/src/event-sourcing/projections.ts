// Projection system for read models in CQRS/Event Sourcing
import type { EventVersion } from '../types/branded';
import type { Event, EventReducer } from './events';

// ============================================================================
// Projection System with Type Safety
// ============================================================================

// Projection type for read models
export interface Projection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: EventReducer<TReadModel, TEvent>;
  getCurrentState(): TReadModel;
  reset(): void;
  getLastProcessedVersion(): EventVersion;
  subscribe(handler: (state: TReadModel) => void): () => void;
}

// Materialized view projection
export interface MaterializedView<TEvent extends Event, TViewModel> extends Projection<TEvent, TViewModel> {
  query<TQuery extends Record<string, unknown>>(params: TQuery): TViewModel | TViewModel[];
  index: string[];
}

// Async projection with side effects
export interface AsyncProjection<TEvent extends Event, TReadModel> {
  name: string;
  initialState: TReadModel;
  handle: (state: TReadModel, event: TEvent) => Promise<TReadModel>;
  getCurrentState(): Promise<TReadModel>;
  reset(): Promise<void>;
  getLastProcessedVersion(): Promise<EventVersion>;
  subscribe(handler: (state: TReadModel) => void): () => void;
}

// Projection builder interface
export interface IProjectionBuilder<TEvent extends Event, TProjection> {
  rebuild(events: TEvent[]): Promise<void>;
  get(id: string): TProjection | null;
  getAll(): TProjection[];
  search(predicate: (projection: TProjection) => boolean): TProjection[];
}

// Query handler interface
export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// Projection state management
export interface ProjectionState<TReadModel> {
  data: TReadModel;
  version: EventVersion;
  lastUpdated: Date;
  eventCount: number;
}

// ============================================================================
// Projection Builder Implementation
// ============================================================================

export class ProjectionBuilder<TEvent extends Event, TReadModel> implements Projection<TEvent, TReadModel> {
  private state: TReadModel;
  private lastVersion: EventVersion = 0 as EventVersion;
  private subscribers: Set<(state: TReadModel) => void> = new Set();
  
  constructor(
    public name: string,
    public initialState: TReadModel,
    public handle: EventReducer<TReadModel, TEvent>
  ) {
    this.state = initialState;
  }
  
  getCurrentState(): TReadModel {
    return this.state;
  }
  
  reset(): void {
    this.state = this.initialState;
    this.lastVersion = 0 as EventVersion;
    this.notifySubscribers();
  }
  
  getLastProcessedVersion(): EventVersion {
    return this.lastVersion;
  }
  
  subscribe(handler: (state: TReadModel) => void): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }
  
  applyEvent(event: TEvent): void {
    this.state = this.handle(this.state, event);
    this.lastVersion = event.version;
    this.notifySubscribers();
  }
  
  applyEvents(events: TEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
  }
  
  private notifySubscribers(): void {
    this.subscribers.forEach(handler => handler(this.state));
  }
}

// ============================================================================
// Materialized View Builder
// ============================================================================

export class MaterializedViewBuilder<TEvent extends Event, TViewModel> 
  extends ProjectionBuilder<TEvent, Map<string, TViewModel>> {
  
  public index: string[];
  
  constructor(
    name: string,
    index: string[],
    private viewReducer: EventReducer<TViewModel | null, TEvent>
  ) {
    super(
      name,
      new Map<string, TViewModel>(),
      (state, event) => {
        if (!state) {
          state = new Map<string, TViewModel>();
        }
        const viewModel = viewReducer(null, event);
        if (viewModel) {
          const key = index.map(field => (event as any)[field]).join(':');
          state.set(key, viewModel);
        }
        return state;
      }
    );
    this.index = index;
  }
  
  query<TQuery extends Record<string, unknown>>(params: TQuery): TViewModel | TViewModel[] {
    const key = this.index.map(field => params[field]).join(':');
    const result = this.getCurrentState().get(key);
    
    if (result) {
      return result;
    }
    
    // Return all matching if partial key
    const matches: TViewModel[] = [];
    for (const [k, v] of this.getCurrentState().entries()) {
      if (k.startsWith(key)) {
        matches.push(v);
      }
    }
    
    return matches;
  }
}

// ============================================================================
// Async Projection Builder
// ============================================================================

export class AsyncProjectionBuilder<TEvent extends Event, TReadModel> implements AsyncProjection<TEvent, TReadModel> {
  private state: TReadModel;
  private lastVersion: EventVersion = 0 as EventVersion;
  private subscribers: Set<(state: TReadModel) => void> = new Set();
  private processing = false;
  private eventQueue: TEvent[] = [];
  
  constructor(
    public name: string,
    public initialState: TReadModel,
    public handle: (state: TReadModel, event: TEvent) => Promise<TReadModel>
  ) {
    this.state = initialState;
  }
  
  async getCurrentState(): Promise<TReadModel> {
    await this.processQueue();
    return this.state;
  }
  
  async reset(): Promise<void> {
    this.state = this.initialState;
    this.lastVersion = 0 as EventVersion;
    this.eventQueue = [];
    this.notifySubscribers();
  }
  
  async getLastProcessedVersion(): Promise<EventVersion> {
    await this.processQueue();
    return this.lastVersion;
  }
  
  subscribe(handler: (state: TReadModel) => void): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }
  
  async applyEvent(event: TEvent): Promise<void> {
    this.eventQueue.push(event);
    await this.processQueue();
  }
  
  async applyEvents(events: TEvent[]): Promise<void> {
    this.eventQueue.push(...events);
    await this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        this.state = await this.handle(this.state, event);
        this.lastVersion = event.version;
        this.notifySubscribers();
      }
    } finally {
      this.processing = false;
    }
  }
  
  private notifySubscribers(): void {
    this.subscribers.forEach(handler => handler(this.state));
  }
}

// ============================================================================
// Projection Registry
// ============================================================================

export class ProjectionRegistry {
  private projections = new Map<string, Projection<any, any>>();
  
  register<TEvent extends Event, TReadModel>(
    projection: Projection<TEvent, TReadModel>
  ): void {
    this.projections.set(projection.name, projection);
  }
  
  get<TEvent extends Event, TReadModel>(
    name: string
  ): Projection<TEvent, TReadModel> | undefined {
    return this.projections.get(name);
  }
  
  getAll(): Projection<any, any>[] {
    return Array.from(this.projections.values());
  }
  
  reset(): void {
    this.projections.forEach(projection => projection.reset());
  }
  
  applyEvent(event: Event): void {
    this.projections.forEach(projection => {
      if ('applyEvent' in projection) {
        (projection as any).applyEvent(event);
      }
    });
  }
}