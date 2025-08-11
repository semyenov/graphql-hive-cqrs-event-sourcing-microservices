import type { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: import("@cqrs/framework/core/branded/types").AggregateId; output: import("@cqrs/framework/core/branded/types").AggregateId; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type CreateUserInput = {
  readonly email: Scalars['String']['input'];
  readonly name: Scalars['String']['input'];
};

export type CreateUserPayload = {
  readonly __typename?: 'CreateUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
  readonly user: Maybe<User>;
};

export type DeleteUserPayload = {
  readonly __typename?: 'DeleteUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
};

export type Error = {
  readonly __typename?: 'Error';
  readonly field: Maybe<Scalars['String']['output']>;
  readonly message: Scalars['String']['output'];
};

export type Mutation = {
  readonly __typename?: 'Mutation';
  readonly createUser: CreateUserPayload;
  readonly deleteUser: DeleteUserPayload;
  readonly updateUser: UpdateUserPayload;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

export type Query = {
  readonly __typename?: 'Query';
  readonly getUser: Maybe<User>;
  readonly listUsers: UserList;
  readonly searchUsers: ReadonlyArray<User>;
};


export type QueryGetUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryListUsersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySearchUsersArgs = {
  query: Scalars['String']['input'];
};

export type UpdateUserInput = {
  readonly email?: InputMaybe<Scalars['String']['input']>;
  readonly name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserPayload = {
  readonly __typename?: 'UpdateUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
  readonly user: Maybe<User>;
};

export type User = {
  readonly __typename?: 'User';
  readonly createdAt: Scalars['String']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly updatedAt: Scalars['String']['output'];
};

export type UserList = {
  readonly __typename?: 'UserList';
  readonly hasMore: Scalars['Boolean']['output'];
  readonly total: Scalars['Int']['output'];
  readonly users: ReadonlyArray<User>;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Partial<Scalars['Boolean']['output']>>;
  CreateUserInput: ResolverTypeWrapper<Partial<CreateUserInput>>;
  CreateUserPayload: ResolverTypeWrapper<Partial<Omit<CreateUserPayload, 'errors' | 'user'> & { errors?: Maybe<ReadonlyArray<ResolversTypes['Error']>>, user?: Maybe<ResolversTypes['User']> }>>;
  DeleteUserPayload: ResolverTypeWrapper<Partial<Omit<DeleteUserPayload, 'errors'> & { errors?: Maybe<ReadonlyArray<ResolversTypes['Error']>> }>>;
  Error: ResolverTypeWrapper<import("../../graphql/error-adapter").GraphQLErrorAdapter>;
  ID: ResolverTypeWrapper<Partial<Scalars['ID']['output']>>;
  Int: ResolverTypeWrapper<Partial<Scalars['Int']['output']>>;
  Mutation: ResolverTypeWrapper<import("../../graphql/context").GraphQLRootValue>;
  Query: ResolverTypeWrapper<import("../../graphql/context").GraphQLRootValue>;
  String: ResolverTypeWrapper<Partial<Scalars['String']['output']>>;
  UpdateUserInput: ResolverTypeWrapper<Partial<UpdateUserInput>>;
  UpdateUserPayload: ResolverTypeWrapper<Partial<Omit<UpdateUserPayload, 'errors' | 'user'> & { errors?: Maybe<ReadonlyArray<ResolversTypes['Error']>>, user?: Maybe<ResolversTypes['User']> }>>;
  User: ResolverTypeWrapper<import("../../graphql/models/User").UserModel>;
  UserList: ResolverTypeWrapper<Partial<Omit<UserList, 'users'> & { users: ReadonlyArray<ResolversTypes['User']> }>>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Partial<Scalars['Boolean']['output']>;
  CreateUserInput: Partial<CreateUserInput>;
  CreateUserPayload: Partial<Omit<CreateUserPayload, 'errors' | 'user'> & { errors?: Maybe<ReadonlyArray<ResolversParentTypes['Error']>>, user?: Maybe<ResolversParentTypes['User']> }>;
  DeleteUserPayload: Partial<Omit<DeleteUserPayload, 'errors'> & { errors?: Maybe<ReadonlyArray<ResolversParentTypes['Error']>> }>;
  Error: import("../../graphql/error-adapter").GraphQLErrorAdapter;
  ID: Partial<Scalars['ID']['output']>;
  Int: Partial<Scalars['Int']['output']>;
  Mutation: import("../../graphql/context").GraphQLRootValue;
  Query: import("../../graphql/context").GraphQLRootValue;
  String: Partial<Scalars['String']['output']>;
  UpdateUserInput: Partial<UpdateUserInput>;
  UpdateUserPayload: Partial<Omit<UpdateUserPayload, 'errors' | 'user'> & { errors?: Maybe<ReadonlyArray<ResolversParentTypes['Error']>>, user?: Maybe<ResolversParentTypes['User']> }>;
  User: import("../../graphql/models/User").UserModel;
  UserList: Partial<Omit<UserList, 'users'> & { users: ReadonlyArray<ResolversParentTypes['User']> }>;
};

export type CreateUserPayloadResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['CreateUserPayload'] = ResolversParentTypes['CreateUserPayload']> = {
  errors?: Resolver<Maybe<ReadonlyArray<ResolversTypes['Error']>>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DeleteUserPayloadResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['DeleteUserPayload'] = ResolversParentTypes['DeleteUserPayload']> = {
  errors?: Resolver<Maybe<ReadonlyArray<ResolversTypes['Error']>>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ErrorResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['Error'] = ResolversParentTypes['Error']> = {
  field?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  createUser?: Resolver<ResolversTypes['CreateUserPayload'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  deleteUser?: Resolver<ResolversTypes['DeleteUserPayload'], ParentType, ContextType, RequireFields<MutationDeleteUserArgs, 'id'>>;
  updateUser?: Resolver<ResolversTypes['UpdateUserPayload'], ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'id' | 'input'>>;
};

export type QueryResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  getUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryGetUserArgs, 'id'>>;
  listUsers?: Resolver<ResolversTypes['UserList'], ParentType, ContextType, RequireFields<QueryListUsersArgs, 'limit' | 'offset'>>;
  searchUsers?: Resolver<ReadonlyArray<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QuerySearchUsersArgs, 'query'>>;
};

export type UpdateUserPayloadResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['UpdateUserPayload'] = ResolversParentTypes['UpdateUserPayload']> = {
  errors?: Resolver<Maybe<ReadonlyArray<ResolversTypes['Error']>>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserListResolvers<ContextType = import("../../graphql/context").GraphQLContext, ParentType extends ResolversParentTypes['UserList'] = ResolversParentTypes['UserList']> = {
  hasMore?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  users?: Resolver<ReadonlyArray<ResolversTypes['User']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = import("../../graphql/context").GraphQLContext> = {
  CreateUserPayload?: CreateUserPayloadResolvers<ContextType>;
  DeleteUserPayload?: DeleteUserPayloadResolvers<ContextType>;
  Error?: ErrorResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  UpdateUserPayload?: UpdateUserPayloadResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  UserList?: UserListResolvers<ContextType>;
};

