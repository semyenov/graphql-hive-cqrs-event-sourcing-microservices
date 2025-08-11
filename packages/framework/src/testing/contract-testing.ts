/**
 * Contract Testing Framework
 * 
 * Consumer-driven contract testing for CQRS/Event Sourcing systems:
 * - API contract validation
 * - Event schema contracts
 * - Command/Query interface contracts
 * - GraphQL schema contracts
 * - Breaking change detection
 * - Contract versioning
 * - Provider verification
 * - Consumer expectations
 */

import * as Effect from 'effect/Effect';
import * as Schema from '@effect/schema/Schema';
import * as Option from 'effect/Option';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import * as fs from 'fs';
import * as path from 'path';
import { GraphQLSchema, buildSchema, printSchema, findBreakingChanges } from 'graphql';

/**
 * Contract types
 */
export enum ContractType {
  REST_API = 'rest_api',
  GRAPHQL = 'graphql',
  EVENT = 'event',
  COMMAND = 'command',
  QUERY = 'query',
  GRPC = 'grpc',
  WEBSOCKET = 'websocket',
}

/**
 * Contract definition
 */
export interface Contract {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: ContractType;
  readonly consumer: string;
  readonly provider: string;
  readonly specification: ContractSpecification;
  readonly metadata: ContractMetadata;
}

/**
 * Contract specification
 */
export type ContractSpecification = 
  | RestApiContract
  | GraphQLContract
  | EventContract
  | CommandContract
  | QueryContract;

/**
 * REST API contract
 */
export interface RestApiContract {
  readonly type: 'rest';
  readonly baseUrl: string;
  readonly endpoints: RestEndpoint[];
}

/**
 * REST endpoint
 */
export interface RestEndpoint {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  readonly path: string;
  readonly description: string;
  readonly request?: {
    headers?: Record<string, string>;
    params?: Record<string, any>;
    body?: any;
    schema?: Schema.Schema<any>;
  };
  readonly response: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
    schema?: Schema.Schema<any>;
  };
  readonly examples?: ContractExample[];
}

/**
 * GraphQL contract
 */
export interface GraphQLContract {
  readonly type: 'graphql';
  readonly schema: string; // SDL string
  readonly operations: GraphQLOperation[];
}

/**
 * GraphQL operation
 */
export interface GraphQLOperation {
  readonly name: string;
  readonly type: 'query' | 'mutation' | 'subscription';
  readonly query: string;
  readonly variables?: Record<string, any>;
  readonly expectedResponse?: any;
  readonly examples?: ContractExample[];
}

/**
 * Event contract
 */
export interface EventContract {
  readonly type: 'event';
  readonly eventType: string;
  readonly schema: Schema.Schema<any>;
  readonly examples: ContractExample[];
  readonly routing?: {
    exchange?: string;
    topic?: string;
    partition?: string;
  };
}

/**
 * Command contract
 */
export interface CommandContract {
  readonly type: 'command';
  readonly commandType: string;
  readonly schema: Schema.Schema<any>;
  readonly validation?: Schema.Schema<any>;
  readonly response?: Schema.Schema<any>;
  readonly examples: ContractExample[];
}

/**
 * Query contract
 */
export interface QueryContract {
  readonly type: 'query';
  readonly queryType: string;
  readonly parameters: Schema.Schema<any>;
  readonly response: Schema.Schema<any>;
  readonly examples: ContractExample[];
}

/**
 * Contract example
 */
export interface ContractExample {
  readonly name: string;
  readonly description: string;
  readonly input: any;
  readonly output: any;
  readonly metadata?: Record<string, any>;
}

/**
 * Contract metadata
 */
export interface ContractMetadata {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly tags: string[];
  readonly documentation?: string;
  readonly deprecation?: {
    deprecated: boolean;
    reason?: string;
    replacement?: string;
  };
}

/**
 * Contract test result
 */
export interface ContractTestResult {
  readonly contract: Contract;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly timestamp: Date;
  readonly duration: Duration.Duration;
  readonly tests: TestCase[];
  readonly coverage: ContractCoverage;
  readonly violations: ContractViolation[];
}

/**
 * Test case
 */
export interface TestCase {
  readonly name: string;
  readonly type: 'consumer' | 'provider';
  readonly passed: boolean;
  readonly duration: Duration.Duration;
  readonly error?: string;
  readonly stackTrace?: string;
}

/**
 * Contract coverage
 */
export interface ContractCoverage {
  readonly total: number;
  readonly tested: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly percentage: number;
}

/**
 * Contract violation
 */
export interface ContractViolation {
  readonly type: ViolationType;
  readonly severity: 'error' | 'warning' | 'info';
  readonly field?: string;
  readonly expected: any;
  readonly actual: any;
  readonly message: string;
}

/**
 * Violation types
 */
export enum ViolationType {
  MISSING_FIELD = 'missing_field',
  TYPE_MISMATCH = 'type_mismatch',
  VALUE_MISMATCH = 'value_mismatch',
  SCHEMA_VIOLATION = 'schema_violation',
  BREAKING_CHANGE = 'breaking_change',
  DEPRECATED_USAGE = 'deprecated_usage',
  VERSION_MISMATCH = 'version_mismatch',
}

/**
 * Contract compatibility result
 */
export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly breakingChanges: BreakingChange[];
  readonly warnings: string[];
  readonly recommendations: string[];
}

/**
 * Breaking change
 */
export interface BreakingChange {
  readonly type: string;
  readonly severity: 'major' | 'minor' | 'patch';
  readonly path: string;
  readonly description: string;
  readonly migration?: string;
}

/**
 * Contract validator
 */
export class ContractValidator {
  /**
   * Validate contract against specification
   */
  validateContract(
    contract: Contract,
    actualData: any
  ): Effect.Effect<ContractTestResult, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const tests: TestCase[] = [];
      const violations: ContractViolation[] = [];
      
      switch (contract.specification.type) {
        case 'rest':
          yield* _(this.validateRestContract(
            contract.specification as RestApiContract,
            actualData,
            tests,
            violations
          ));
          break;
          
        case 'graphql':
          yield* _(this.validateGraphQLContract(
            contract.specification as GraphQLContract,
            actualData,
            tests,
            violations
          ));
          break;
          
        case 'event':
          yield* _(this.validateEventContract(
            contract.specification as EventContract,
            actualData,
            tests,
            violations
          ));
          break;
          
        case 'command':
          yield* _(this.validateCommandContract(
            contract.specification as CommandContract,
            actualData,
            tests,
            violations
          ));
          break;
          
        case 'query':
          yield* _(this.validateQueryContract(
            contract.specification as QueryContract,
            actualData,
            tests,
            violations
          ));
          break;
      }
      
      const passed = tests.filter(t => t.passed).length;
      const failed = tests.filter(t => !t.passed).length;
      
      return {
        contract,
        status: failed === 0 ? 'passed' : 'failed',
        timestamp: new Date(),
        duration: Duration.millis(Date.now() - startTime),
        tests,
        coverage: {
          total: tests.length,
          tested: tests.length,
          passed,
          failed,
          skipped: 0,
          percentage: tests.length > 0 ? (passed / tests.length) * 100 : 0,
        },
        violations,
      };
    });
  }

  /**
   * Validate REST contract
   */
  private validateRestContract(
    spec: RestApiContract,
    actualData: any,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      for (const endpoint of spec.endpoints) {
        const testName = `${endpoint.method} ${endpoint.path}`;
        const startTime = Date.now();
        
        try {
          // Validate request schema if provided
          if (endpoint.request?.schema) {
            const parseResult = Schema.decodeUnknownEither(endpoint.request.schema)(actualData.request);
            if (parseResult._tag === 'Left') {
              violations.push({
                type: ViolationType.SCHEMA_VIOLATION,
                severity: 'error',
                field: 'request',
                expected: endpoint.request.schema,
                actual: actualData.request,
                message: `Request validation failed: ${parseResult.left}`,
              });
              
              tests.push({
                name: `${testName} - Request`,
                type: 'provider',
                passed: false,
                duration: Duration.millis(Date.now() - startTime),
                error: 'Request schema validation failed',
              });
              continue;
            }
          }
          
          // Validate response schema
          if (endpoint.response.schema) {
            const parseResult = Schema.decodeUnknownEither(endpoint.response.schema)(actualData.response);
            if (parseResult._tag === 'Left') {
              violations.push({
                type: ViolationType.SCHEMA_VIOLATION,
                severity: 'error',
                field: 'response',
                expected: endpoint.response.schema,
                actual: actualData.response,
                message: `Response validation failed: ${parseResult.left}`,
              });
              
              tests.push({
                name: `${testName} - Response`,
                type: 'provider',
                passed: false,
                duration: Duration.millis(Date.now() - startTime),
                error: 'Response schema validation failed',
              });
            } else {
              tests.push({
                name: testName,
                type: 'provider',
                passed: true,
                duration: Duration.millis(Date.now() - startTime),
              });
            }
          }
          
        } catch (error) {
          tests.push({
            name: testName,
            type: 'provider',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: String(error),
          });
        }
      }
    });
  }

  /**
   * Validate GraphQL contract
   */
  private validateGraphQLContract(
    spec: GraphQLContract,
    actualSchema: string | GraphQLSchema,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      
      try {
        // Parse schemas
        const expectedSchema = buildSchema(spec.schema);
        const providedSchema = typeof actualSchema === 'string' 
          ? buildSchema(actualSchema)
          : actualSchema;
        
        // Check for breaking changes
        const breakingChanges = findBreakingChanges(expectedSchema, providedSchema);
        
        if (breakingChanges.length > 0) {
          for (const change of breakingChanges) {
            violations.push({
              type: ViolationType.BREAKING_CHANGE,
              severity: 'error',
              field: change.path,
              expected: 'No breaking changes',
              actual: change.description,
              message: change.description,
            });
          }
          
          tests.push({
            name: 'GraphQL Schema Compatibility',
            type: 'provider',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: `${breakingChanges.length} breaking changes detected`,
          });
        } else {
          tests.push({
            name: 'GraphQL Schema Compatibility',
            type: 'provider',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
        
        // Validate operations
        for (const operation of spec.operations) {
          yield* _(this.validateGraphQLOperation(
            operation,
            providedSchema,
            tests,
            violations
          ));
        }
        
      } catch (error) {
        tests.push({
          name: 'GraphQL Schema Validation',
          type: 'provider',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }

  /**
   * Validate GraphQL operation
   */
  private validateGraphQLOperation(
    operation: GraphQLOperation,
    schema: GraphQLSchema,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const { graphql } = require('graphql');
      
      try {
        // Execute operation against schema
        const result = yield* _(
          Effect.tryPromise({
            try: () => graphql({
              schema,
              source: operation.query,
              variableValues: operation.variables,
            }),
            catch: (error) => error as Error,
          })
        );
        
        if (result.errors) {
          violations.push({
            type: ViolationType.SCHEMA_VIOLATION,
            severity: 'error',
            field: operation.name,
            expected: 'Valid operation',
            actual: result.errors,
            message: `Operation failed: ${result.errors.map((e: any) => e.message).join(', ')}`,
          });
          
          tests.push({
            name: `GraphQL ${operation.type}: ${operation.name}`,
            type: 'consumer',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Operation execution failed',
          });
        } else {
          tests.push({
            name: `GraphQL ${operation.type}: ${operation.name}`,
            type: 'consumer',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
        
      } catch (error) {
        tests.push({
          name: `GraphQL ${operation.type}: ${operation.name}`,
          type: 'consumer',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }

  /**
   * Validate event contract
   */
  private validateEventContract(
    spec: EventContract,
    actualEvent: any,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const testName = `Event: ${spec.eventType}`;
      
      try {
        // Validate schema
        const parseResult = Schema.decodeUnknownEither(spec.schema)(actualEvent);
        
        if (parseResult._tag === 'Left') {
          violations.push({
            type: ViolationType.SCHEMA_VIOLATION,
            severity: 'error',
            field: 'event',
            expected: spec.schema,
            actual: actualEvent,
            message: `Event validation failed: ${parseResult.left}`,
          });
          
          tests.push({
            name: testName,
            type: 'provider',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Event schema validation failed',
          });
        } else {
          tests.push({
            name: testName,
            type: 'provider',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
        
        // Validate examples
        for (const example of spec.examples) {
          yield* _(this.validateExample(
            example,
            spec.schema,
            tests,
            violations
          ));
        }
        
      } catch (error) {
        tests.push({
          name: testName,
          type: 'provider',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }

  /**
   * Validate command contract
   */
  private validateCommandContract(
    spec: CommandContract,
    actualCommand: any,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const testName = `Command: ${spec.commandType}`;
      
      try {
        // Validate command schema
        const parseResult = Schema.decodeUnknownEither(spec.schema)(actualCommand);
        
        if (parseResult._tag === 'Left') {
          violations.push({
            type: ViolationType.SCHEMA_VIOLATION,
            severity: 'error',
            field: 'command',
            expected: spec.schema,
            actual: actualCommand,
            message: `Command validation failed: ${parseResult.left}`,
          });
          
          tests.push({
            name: testName,
            type: 'consumer',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Command schema validation failed',
          });
        } else {
          tests.push({
            name: testName,
            type: 'consumer',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
        
        // Validate validation schema if provided
        if (spec.validation) {
          const validationResult = Schema.decodeUnknownEither(spec.validation)(actualCommand);
          
          if (validationResult._tag === 'Left') {
            violations.push({
              type: ViolationType.SCHEMA_VIOLATION,
              severity: 'warning',
              field: 'validation',
              expected: spec.validation,
              actual: actualCommand,
              message: `Validation schema failed: ${validationResult.left}`,
            });
          }
        }
        
      } catch (error) {
        tests.push({
          name: testName,
          type: 'consumer',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }

  /**
   * Validate query contract
   */
  private validateQueryContract(
    spec: QueryContract,
    actualQuery: { params: any; response: any },
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const testName = `Query: ${spec.queryType}`;
      
      try {
        // Validate parameters
        const paramsResult = Schema.decodeUnknownEither(spec.parameters)(actualQuery.params);
        
        if (paramsResult._tag === 'Left') {
          violations.push({
            type: ViolationType.SCHEMA_VIOLATION,
            severity: 'error',
            field: 'parameters',
            expected: spec.parameters,
            actual: actualQuery.params,
            message: `Query parameters validation failed: ${paramsResult.left}`,
          });
          
          tests.push({
            name: `${testName} - Parameters`,
            type: 'consumer',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Query parameters validation failed',
          });
        }
        
        // Validate response
        const responseResult = Schema.decodeUnknownEither(spec.response)(actualQuery.response);
        
        if (responseResult._tag === 'Left') {
          violations.push({
            type: ViolationType.SCHEMA_VIOLATION,
            severity: 'error',
            field: 'response',
            expected: spec.response,
            actual: actualQuery.response,
            message: `Query response validation failed: ${responseResult.left}`,
          });
          
          tests.push({
            name: `${testName} - Response`,
            type: 'provider',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Query response validation failed',
          });
        } else {
          tests.push({
            name: testName,
            type: 'provider',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
        
      } catch (error) {
        tests.push({
          name: testName,
          type: 'provider',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }

  /**
   * Validate example
   */
  private validateExample(
    example: ContractExample,
    schema: Schema.Schema<any>,
    tests: TestCase[],
    violations: ContractViolation[]
  ): Effect.Effect<void, Error, never> {
    return Effect.gen(function* (_) {
      const startTime = Date.now();
      const testName = `Example: ${example.name}`;
      
      try {
        const inputResult = Schema.decodeUnknownEither(schema)(example.input);
        const outputResult = Schema.decodeUnknownEither(schema)(example.output);
        
        if (inputResult._tag === 'Left' || outputResult._tag === 'Left') {
          tests.push({
            name: testName,
            type: 'consumer',
            passed: false,
            duration: Duration.millis(Date.now() - startTime),
            error: 'Example validation failed',
          });
        } else {
          tests.push({
            name: testName,
            type: 'consumer',
            passed: true,
            duration: Duration.millis(Date.now() - startTime),
          });
        }
      } catch (error) {
        tests.push({
          name: testName,
          type: 'consumer',
          passed: false,
          duration: Duration.millis(Date.now() - startTime),
          error: String(error),
        });
      }
    });
  }
}

/**
 * Contract compatibility checker
 */
export class ContractCompatibilityChecker {
  /**
   * Check compatibility between versions
   */
  checkCompatibility(
    oldContract: Contract,
    newContract: Contract
  ): CompatibilityResult {
    const breakingChanges: BreakingChange[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Version check
    if (this.isBreakingVersion(oldContract.version, newContract.version)) {
      breakingChanges.push({
        type: 'version',
        severity: 'major',
        path: 'version',
        description: `Major version change from ${oldContract.version} to ${newContract.version}`,
      });
    }
    
    // Type-specific compatibility checks
    switch (oldContract.type) {
      case ContractType.GRAPHQL:
        this.checkGraphQLCompatibility(
          oldContract.specification as GraphQLContract,
          newContract.specification as GraphQLContract,
          breakingChanges,
          warnings
        );
        break;
        
      case ContractType.REST_API:
        this.checkRestApiCompatibility(
          oldContract.specification as RestApiContract,
          newContract.specification as RestApiContract,
          breakingChanges,
          warnings
        );
        break;
        
      case ContractType.EVENT:
        this.checkEventCompatibility(
          oldContract.specification as EventContract,
          newContract.specification as EventContract,
          breakingChanges,
          warnings
        );
        break;
    }
    
    // Generate recommendations
    if (breakingChanges.length > 0) {
      recommendations.push('Consider versioning the API to maintain backward compatibility');
      recommendations.push('Document migration guides for breaking changes');
    }
    
    if (warnings.length > 5) {
      recommendations.push('High number of warnings - consider reviewing contract design');
    }
    
    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      warnings,
      recommendations,
    };
  }

  /**
   * Check if version change is breaking
   */
  private isBreakingVersion(oldVersion: string, newVersion: string): boolean {
    const oldMajor = parseInt(oldVersion.split('.')[0]);
    const newMajor = parseInt(newVersion.split('.')[0]);
    return newMajor > oldMajor;
  }

  /**
   * Check GraphQL compatibility
   */
  private checkGraphQLCompatibility(
    oldSpec: GraphQLContract,
    newSpec: GraphQLContract,
    breakingChanges: BreakingChange[],
    warnings: string[]
  ): void {
    try {
      const oldSchema = buildSchema(oldSpec.schema);
      const newSchema = buildSchema(newSpec.schema);
      
      const changes = findBreakingChanges(oldSchema, newSchema);
      
      for (const change of changes) {
        breakingChanges.push({
          type: 'graphql',
          severity: 'major',
          path: change.path || '',
          description: change.description,
        });
      }
    } catch (error) {
      warnings.push(`Failed to analyze GraphQL schema changes: ${error}`);
    }
  }

  /**
   * Check REST API compatibility
   */
  private checkRestApiCompatibility(
    oldSpec: RestApiContract,
    newSpec: RestApiContract,
    breakingChanges: BreakingChange[],
    warnings: string[]
  ): void {
    // Check removed endpoints
    for (const oldEndpoint of oldSpec.endpoints) {
      const newEndpoint = newSpec.endpoints.find(e => 
        e.method === oldEndpoint.method && e.path === oldEndpoint.path
      );
      
      if (!newEndpoint) {
        breakingChanges.push({
          type: 'endpoint',
          severity: 'major',
          path: `${oldEndpoint.method} ${oldEndpoint.path}`,
          description: 'Endpoint removed',
        });
      }
    }
    
    // Check modified endpoints
    for (const newEndpoint of newSpec.endpoints) {
      const oldEndpoint = oldSpec.endpoints.find(e => 
        e.method === newEndpoint.method && e.path === newEndpoint.path
      );
      
      if (oldEndpoint) {
        // Check required parameters added
        if (newEndpoint.request?.params) {
          for (const param in newEndpoint.request.params) {
            if (!oldEndpoint.request?.params?.[param]) {
              warnings.push(`New parameter added: ${param} in ${newEndpoint.method} ${newEndpoint.path}`);
            }
          }
        }
      }
    }
  }

  /**
   * Check event compatibility
   */
  private checkEventCompatibility(
    oldSpec: EventContract,
    newSpec: EventContract,
    breakingChanges: BreakingChange[],
    warnings: string[]
  ): void {
    // Check event type change
    if (oldSpec.eventType !== newSpec.eventType) {
      breakingChanges.push({
        type: 'event',
        severity: 'major',
        path: 'eventType',
        description: `Event type changed from ${oldSpec.eventType} to ${newSpec.eventType}`,
      });
    }
    
    // Schema compatibility would be checked using Schema library
    warnings.push('Event schema compatibility check not fully implemented');
  }
}

/**
 * Contract testing service
 */
export class ContractTestingService {
  private contracts: Map<string, Contract> = new Map();
  private validator = new ContractValidator();
  private compatibilityChecker = new ContractCompatibilityChecker();

  /**
   * Register contract
   */
  registerContract(contract: Contract): Effect.Effect<void, Error, never> {
    return Effect.sync(() => {
      this.contracts.set(contract.id, contract);
      console.log(`📝 Contract registered: ${contract.name} v${contract.version}`);
    });
  }

  /**
   * Run contract tests
   */
  runContractTests(
    contractId: string,
    testData: any
  ): Effect.Effect<ContractTestResult, Error, never> {
    return Effect.gen(function* (_) {
      const contract = this.contracts.get(contractId);
      
      if (!contract) {
        return yield* _(Effect.fail(new Error(`Contract not found: ${contractId}`)));
      }
      
      console.log(`🧪 Testing contract: ${contract.name}`);
      
      const result = yield* _(this.validator.validateContract(contract, testData));
      
      // Display results
      this.displayTestResults(result);
      
      return result;
    });
  }

  /**
   * Check contract compatibility
   */
  checkCompatibility(
    oldContractId: string,
    newContractId: string
  ): Effect.Effect<CompatibilityResult, Error, never> {
    return Effect.gen(function* (_) {
      const oldContract = this.contracts.get(oldContractId);
      const newContract = this.contracts.get(newContractId);
      
      if (!oldContract || !newContract) {
        return yield* _(Effect.fail(new Error('Contract not found')));
      }
      
      console.log(`🔍 Checking compatibility: ${oldContract.version} -> ${newContract.version}`);
      
      const result = this.compatibilityChecker.checkCompatibility(oldContract, newContract);
      
      // Display results
      this.displayCompatibilityResults(result);
      
      return result;
    });
  }

  /**
   * Display test results
   */
  private displayTestResults(result: ContractTestResult): void {
    console.log('\n📊 Contract Test Results:');
    console.log(`  Status: ${result.status === 'passed' ? '✅' : '❌'} ${result.status.toUpperCase()}`);
    console.log(`  Coverage: ${result.coverage.percentage.toFixed(1)}%`);
    console.log(`  Tests: ${result.coverage.passed}/${result.coverage.total} passed`);
    
    if (result.violations.length > 0) {
      console.log('\n⚠️ Violations:');
      for (const violation of result.violations) {
        console.log(`  ${violation.severity.toUpperCase()}: ${violation.message}`);
      }
    }
  }

  /**
   * Display compatibility results
   */
  private displayCompatibilityResults(result: CompatibilityResult): void {
    console.log('\n🔄 Compatibility Check:');
    console.log(`  Compatible: ${result.compatible ? '✅ YES' : '❌ NO'}`);
    
    if (result.breakingChanges.length > 0) {
      console.log('\n💔 Breaking Changes:');
      for (const change of result.breakingChanges) {
        console.log(`  ${change.severity.toUpperCase()}: ${change.description}`);
      }
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      for (const warning of result.warnings) {
        console.log(`  ${warning}`);
      }
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of result.recommendations) {
        console.log(`  ${rec}`);
      }
    }
  }
}

/**
 * CQRS-specific contract builders
 */
export class CQRSContractBuilders {
  /**
   * Create command contract
   */
  static createCommandContract(
    commandType: string,
    schema: Schema.Schema<any>,
    consumer: string,
    provider: string
  ): Contract {
    return {
      id: `cmd-${commandType}-${Date.now()}`,
      name: `${commandType} Command Contract`,
      version: '1.0.0',
      type: ContractType.COMMAND,
      consumer,
      provider,
      specification: {
        type: 'command',
        commandType,
        schema,
        examples: [],
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['command', commandType],
      },
    };
  }

  /**
   * Create event contract
   */
  static createEventContract(
    eventType: string,
    schema: Schema.Schema<any>,
    consumer: string,
    provider: string,
    examples: ContractExample[]
  ): Contract {
    return {
      id: `evt-${eventType}-${Date.now()}`,
      name: `${eventType} Event Contract`,
      version: '1.0.0',
      type: ContractType.EVENT,
      consumer,
      provider,
      specification: {
        type: 'event',
        eventType,
        schema,
        examples,
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['event', eventType],
      },
    };
  }

  /**
   * Create query contract
   */
  static createQueryContract(
    queryType: string,
    parameters: Schema.Schema<any>,
    response: Schema.Schema<any>,
    consumer: string,
    provider: string
  ): Contract {
    return {
      id: `qry-${queryType}-${Date.now()}`,
      name: `${queryType} Query Contract`,
      version: '1.0.0',
      type: ContractType.QUERY,
      consumer,
      provider,
      specification: {
        type: 'query',
        queryType,
        parameters,
        response,
        examples: [],
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['query', queryType],
      },
    };
  }
}

/**
 * Create contract testing service
 */
export const createContractTestingService = (): ContractTestingService => {
  return new ContractTestingService();
};