import type { ResultOf, VariablesOf } from 'gql.tada';

// Client that uses persisted documents for security and performance
export class PersistedDocumentClient {
  private documentMap: Map<string, string>;

  constructor(
    private endpoint: string,
    private persistedManifest?: Record<string, string>
  ) {
    this.documentMap = new Map(Object.entries(persistedManifest || {}));
  }

  // Execute persisted document by ID
  async executePersistedDocument<TResult, TVariables>(
    documentId: string,
    variables?: TVariables
  ): Promise<TResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-name': 'persisted-client',
        'client-version': '1.0.0',
      },
      body: JSON.stringify({
        // Send only the document ID, not the full query
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: documentId,
          },
        },
        variables,
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new GraphQLError(result.errors);
    }
    
    return result.data;
  }

  // Execute with fallback to full query if server doesn't have the persisted query
  async executeWithFallback<TResult, TVariables>(
    documentId: string,
    query: string,
    variables?: TVariables
  ): Promise<TResult> {
    try {
      // Try persisted query first
      return await this.executePersistedDocument<TResult, TVariables>(
        documentId,
        variables
      );
    } catch (error: any) {
      // If server doesn't have the persisted query, fall back to full query
      if (error.message?.includes('PersistedQueryNotFound')) {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'client-name': 'persisted-client',
            'client-version': '1.0.0',
          },
          body: JSON.stringify({
            query,
            variables,
            // Also send the hash so server can cache it
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: documentId,
              },
            },
          }),
        });

        const result = await response.json();
        
        if (result.errors) {
          throw new GraphQLError(result.errors);
        }
        
        return result.data;
      }
      
      throw error;
    }
  }

  // Convert to GET request for CDN caching
  async executeAsGet<TResult, TVariables>(
    documentId: string,
    variables?: TVariables
  ): Promise<TResult> {
    const params = new URLSearchParams({
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: documentId,
        },
      }),
    });

    if (variables) {
      params.append('variables', JSON.stringify(variables));
    }

    const response = await fetch(`${this.endpoint}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'client-name': 'persisted-client',
        'client-version': '1.0.0',
      },
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new GraphQLError(result.errors);
    }
    
    return result.data;
  }

  // Helper to get query from manifest
  getQueryFromManifest(documentId: string): string | undefined {
    return this.documentMap.get(documentId);
  }
}

// Custom error class
export class GraphQLError extends Error {
  constructor(public errors: any[]) {
    super(errors.map(e => e.message).join(', '));
    this.name = 'GraphQLError';
  }
}

// Example usage with type safety
export async function demonstratePersistedClient() {
  // In production, load this from a generated manifest
  const manifest = {
    'getUserById': 'query GetUser($id: ID!) { getUser(id: $id) { ... } }',
    'listUsersWithPagination': 'query ListUsers($limit: Int) { ... }',
  };

  const client = new PersistedDocumentClient(
    'http://localhost:3000/graphql',
    manifest
  );

  console.log('🔒 Persisted Document Client Demo\n');

  // 1. Execute persisted query by ID only
  console.log('1️⃣ Executing persisted query (ID only)...');
  try {
    const result = await client.executePersistedDocument(
      'getUserById',
      { id: '123' }
    );
    console.log('✅ Success with persisted query');
  } catch (error) {
    console.log('❌ Server might not have the persisted query');
  }

  // 2. Execute with fallback
  console.log('\n2️⃣ Executing with fallback...');
  const userResult = await client.executeWithFallback(
    'getUserById',
    manifest['getUserById']!,
    { id: '123' }
  );
  console.log('✅ Success with fallback support');

  // 3. Use GET for CDN caching
  console.log('\n3️⃣ Using GET request for CDN...');
  const cachedResult = await client.executeAsGet(
    'listUsersWithPagination',
    { limit: 10 }
  );
  console.log('✅ Cacheable GET request executed');

  console.log('\n📊 Benefits:');
  console.log('- Reduced bandwidth (only send document ID)');
  console.log('- Enhanced security (whitelist queries)');
  console.log('- CDN caching with GET requests');
  console.log('- Automatic fallback for development');
}