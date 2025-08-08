// Template literal type utilities for naming conventions

// Convert string to PascalCase
export type PascalCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

// Convert string to camelCase
export type CamelCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S;

// Convert string to snake_case
export type SnakeCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends `${infer Second}${infer Tail}`
    ? Second extends Uppercase<Second>
      ? `${Lowercase<First>}_${SnakeCase<`${Second}${Tail}`>}`
      : `${Lowercase<First>}${SnakeCase<Rest>}`
    : `${Lowercase<First>}${Rest}`
  : S;

// Convert string to kebab-case
export type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends `${infer Second}${infer Tail}`
    ? Second extends Uppercase<Second>
      ? `${Lowercase<First>}-${KebabCase<`${Second}${Tail}`>}`
      : `${Lowercase<First>}${KebabCase<Rest>}`
    : `${Lowercase<First>}${Rest}`
  : S;

// Event name builder using template literals
export type EventName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAggregateType>}${PascalCase<TAction>}`;

// Command name builder
export type CommandName<TAggregateType extends string, TAction extends string> = 
  `${PascalCase<TAction>}${PascalCase<TAggregateType>}`;

// Query name builder
export type QueryName<TAggregateType extends string, TQuery extends string> = 
  `Get${PascalCase<TAggregateType>}${PascalCase<TQuery>}`;

// Projection name builder
export type ProjectionName<TAggregateType extends string> = 
  `${PascalCase<TAggregateType>}Projection`;

// Saga name builder
export type SagaName<TProcess extends string> = 
  `${PascalCase<TProcess>}Saga`;

// Handler name builder
export type HandlerName<TType extends string, THandler extends string> = 
  `${PascalCase<TType>}${PascalCase<THandler>}Handler`;

// Repository name builder
export type RepositoryName<TAggregateType extends string> = 
  `${PascalCase<TAggregateType>}Repository`;

// Factory name builder
export type FactoryName<TType extends string> = 
  `${PascalCase<TType>}Factory`;

// Service name builder
export type ServiceName<TDomain extends string> = 
  `${PascalCase<TDomain>}Service`;

// Controller name builder
export type ControllerName<TResource extends string> = 
  `${PascalCase<TResource>}Controller`;

// Middleware name builder
export type MiddlewareName<TFunction extends string> = 
  `${PascalCase<TFunction>}Middleware`;

// Validator name builder
export type ValidatorName<TEntity extends string> = 
  `${PascalCase<TEntity>}Validator`;

// Error name builder
export type ErrorName<TDomain extends string, TError extends string> = 
  `${PascalCase<TDomain>}${PascalCase<TError>}Error`;

// Interface name builder (with I prefix)
export type InterfaceName<TType extends string> = 
  `I${PascalCase<TType>}`;

// Abstract class name builder
export type AbstractClassName<TType extends string> = 
  `Abstract${PascalCase<TType>}`;

// Enum name builder
export type EnumName<TType extends string> = 
  `${PascalCase<TType>}Enum`;

// Constant name builder (SCREAMING_SNAKE_CASE)
export type ConstantName<TName extends string> = Uppercase<SnakeCase<TName>>;

// File name builder
export type FileName<TName extends string, TExtension extends string = 'ts'> = 
  `${KebabCase<TName>}.${TExtension}`;

// Module name builder
export type ModuleName<TDomain extends string> = 
  `${PascalCase<TDomain>}Module`;

// Package name builder
export type PackageName<TScope extends string, TName extends string> = 
  `@${KebabCase<TScope>}/${KebabCase<TName>}`;

// Route path builder
export type RoutePath<TResource extends string, TAction extends string = ''> = 
  TAction extends ''
    ? `/${KebabCase<TResource>}`
    : `/${KebabCase<TResource>}/${KebabCase<TAction>}`;

// Environment variable name builder
export type EnvVarName<TName extends string> = ConstantName<TName>;

// Database table name builder
export type TableName<TEntity extends string> = SnakeCase<TEntity>;

// Database column name builder
export type ColumnName<TField extends string> = SnakeCase<TField>;

// GraphQL type name builder
export type GraphQLTypeName<TType extends string> = PascalCase<TType>;

// GraphQL field name builder
export type GraphQLFieldName<TField extends string> = CamelCase<TField>;

// GraphQL input name builder
export type GraphQLInputName<TType extends string> = 
  `${PascalCase<TType>}Input`;

// GraphQL payload name builder
export type GraphQLPayloadName<TOperation extends string> = 
  `${PascalCase<TOperation>}Payload`;

// GraphQL subscription name builder
export type GraphQLSubscriptionName<TEntity extends string, TEvent extends string> = 
  `${CamelCase<TEntity>}${PascalCase<TEvent>}`;

// Test file name builder
export type TestFileName<TName extends string> = 
  `${KebabCase<TName>}.test.ts`;

// Spec file name builder
export type SpecFileName<TName extends string> = 
  `${KebabCase<TName>}.spec.ts`;

// Type file name builder
export type TypeFileName<TName extends string> = 
  `${KebabCase<TName>}.type.ts`;

// Interface file name builder
export type InterfaceFileName<TName extends string> = 
  `${KebabCase<TName>}.interface.ts`;