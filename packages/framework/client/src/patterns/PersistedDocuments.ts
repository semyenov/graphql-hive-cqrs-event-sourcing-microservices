// Generic persisted document interface
export interface PersistedDocument<TResult = unknown, TVariables = Record<string, unknown>> {
  readonly id: string;
  readonly query: string;
  readonly operationName?: string;
  readonly operationType: 'query' | 'mutation' | 'subscription';
}

// Persisted document store interface
export interface PersistedDocumentStore {
  get<TResult, TVariables>(id: string): PersistedDocument<TResult, TVariables> | undefined;
  has(id: string): boolean;
  register<TResult, TVariables>(document: PersistedDocument<TResult, TVariables>): void;
  list(): ReadonlyArray<PersistedDocument>;
}

// In-memory persisted document store
export class InMemoryPersistedDocumentStore implements PersistedDocumentStore {
  private readonly documents = new Map<string, PersistedDocument>();

  get<TResult, TVariables>(id: string): PersistedDocument<TResult, TVariables> | undefined {
    const doc = this.documents.get(id);
    return doc as PersistedDocument<TResult, TVariables> | undefined;
  }

  has(id: string): boolean {
    return this.documents.has(id);
  }

  register<TResult, TVariables>(document: PersistedDocument<TResult, TVariables>): void {
    this.documents.set(document.id, document);
  }

  list(): ReadonlyArray<PersistedDocument> {
    return Array.from(this.documents.values());
  }

  clear(): void {
    this.documents.clear();
  }

  size(): number {
    return this.documents.size;
  }
}

// Persisted document registry for organizing documents
export class PersistedDocumentRegistry {
  private readonly stores = new Map<string, PersistedDocumentStore>();
  private readonly defaultStore: PersistedDocumentStore;

  constructor() {
    this.defaultStore = new InMemoryPersistedDocumentStore();
    this.stores.set('default', this.defaultStore);
  }

  // Create or get a named store
  store(name: string = 'default'): PersistedDocumentStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, new InMemoryPersistedDocumentStore());
    }
    return this.stores.get(name)!;
  }

  // Register a document in a specific store
  register<TResult, TVariables>(
    document: PersistedDocument<TResult, TVariables>,
    storeName: string = 'default'
  ): void {
    this.store(storeName).register(document);
  }

  // Get a document from a specific store
  get<TResult, TVariables>(
    id: string,
    storeName: string = 'default'
  ): PersistedDocument<TResult, TVariables> | undefined {
    return this.store(storeName).get<TResult, TVariables>(id);
  }

  // Check if a document exists in any store
  has(id: string): boolean {
    for (const store of this.stores.values()) {
      if (store.has(id)) {
        return true;
      }
    }
    return false;
  }

  // Find which store contains a document
  findStore(id: string): string | undefined {
    for (const [name, store] of this.stores.entries()) {
      if (store.has(id)) {
        return name;
      }
    }
    return undefined;
  }

  // Get all documents from all stores
  listAll(): Record<string, ReadonlyArray<PersistedDocument>> {
    const result: Record<string, ReadonlyArray<PersistedDocument>> = {};
    for (const [name, store] of this.stores.entries()) {
      result[name] = store.list();
    }
    return result;
  }

  // Clear all stores
  clear(): void {
    for (const store of this.stores.values()) {
      if ('clear' in store && typeof store.clear === 'function') {
        store.clear();
      }
    }
  }

  // Get registry statistics
  getStats(): {
    readonly totalStores: number;
    readonly totalDocuments: number;
    readonly documentsByStore: Record<string, number>;
    readonly operationTypes: Record<string, number>;
  } {
    let totalDocuments = 0;
    const documentsByStore: Record<string, number> = {};
    const operationTypes: Record<string, number> = {
      query: 0,
      mutation: 0,
      subscription: 0,
    };

    for (const [name, store] of this.stores.entries()) {
      const documents = store.list();
      const count = documents.length;
      
      documentsByStore[name] = count;
      totalDocuments += count;

      // Count operation types
      for (const doc of documents) {
        operationTypes[doc.operationType] = (operationTypes[doc.operationType] || 0) + 1;
      }
    }

    return {
      totalStores: this.stores.size,
      totalDocuments,
      documentsByStore,
      operationTypes,
    };
  }
}

// Helper to create persisted document from query string
export function createPersistedDocument<TResult = unknown, TVariables = Record<string, unknown>>(
  id: string,
  query: string,
  options?: {
    readonly operationName?: string;
    readonly operationType?: 'query' | 'mutation' | 'subscription';
  }
): PersistedDocument<TResult, TVariables> {
  // Auto-detect operation type if not provided
  let operationType = options?.operationType;
  if (!operationType) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.startsWith('mutation')) {
      operationType = 'mutation';
    } else if (trimmedQuery.startsWith('subscription')) {
      operationType = 'subscription';
    } else {
      operationType = 'query';
    }
  }

  return {
    id,
    query,
    ...(options?.operationName !== undefined ? { operationName: options.operationName } : {}),
    operationType,
  };
}

// Helper to extract operation name from query
export function extractOperationName(query: string): string | undefined {
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
  return match?.[1];
}

// Helper to validate persisted document
export function validatePersistedDocument(document: PersistedDocument): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  if (!document.id || typeof document.id !== 'string') {
    errors.push('Document ID must be a non-empty string');
  }

  if (!document.query || typeof document.query !== 'string') {
    errors.push('Document query must be a non-empty string');
  }

  if (!['query', 'mutation', 'subscription'].includes(document.operationType)) {
    errors.push('Operation type must be query, mutation, or subscription');
  }

  // Basic GraphQL syntax check
  if (document.query) {
    const trimmedQuery = document.query.trim();
    if (!trimmedQuery.startsWith(document.operationType)) {
      errors.push(`Query should start with operation type: ${document.operationType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Global registry instance
export const persistedDocuments = new PersistedDocumentRegistry();