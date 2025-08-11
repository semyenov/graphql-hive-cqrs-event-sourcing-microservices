import { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: import("../../core/branded").AggregateId; output: import("../../core/branded").AggregateId; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type CreateUserInput = {
  readonly __typename?: 'CreateUserInput';
  readonly email: Scalars['String']['output'];
  readonly name: Scalars['String']['output'];
};

export type Mutation = {
  readonly __typename?: 'Mutation';
  readonly createUser: User;
  readonly deleteUser: Scalars['Boolean']['output'];
  readonly updateUser: User;
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
  readonly health: Scalars['String']['output'];
  readonly user: Maybe<User>;
  readonly users: ReadonlyArray<User>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type Subscription = {
  readonly __typename?: 'Subscription';
  readonly userUpdated: User;
};


export type SubscriptionUserUpdatedArgs = {
  id: Scalars['ID']['input'];
};

export type UpdateUserInput = {
  readonly __typename?: 'UpdateUserInput';
  readonly email: Maybe<Scalars['String']['output']>;
  readonly name: Maybe<Scalars['String']['output']>;
};

export type User = {
  readonly __typename?: 'User';
  readonly createdAt: Scalars['String']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly updatedAt: Scalars['String']['output'];
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
  ID: ResolverTypeWrapper<Partial<Scalars['ID']['output']>>;
  Mutation: ResolverTypeWrapper<import("../../server").GraphQLRootValue>;
  Query: ResolverTypeWrapper<import("../../server").GraphQLRootValue>;
  String: ResolverTypeWrapper<Partial<Scalars['String']['output']>>;
  Subscription: ResolverTypeWrapper<import("../../server").GraphQLRootValue>;
  UpdateUserInput: ResolverTypeWrapper<Partial<UpdateUserInput>>;
  User: ResolverTypeWrapper<import("../../models/User").UserModel>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Partial<Scalars['Boolean']['output']>;
  CreateUserInput: Partial<CreateUserInput>;
  ID: Partial<Scalars['ID']['output']>;
  Mutation: import("../../server").GraphQLRootValue;
  Query: import("../../server").GraphQLRootValue;
  String: Partial<Scalars['String']['output']>;
  Subscription: import("../../server").GraphQLRootValue;
  UpdateUserInput: Partial<UpdateUserInput>;
  User: import("../../models/User").UserModel;
};

export type CreateUserInputResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['CreateUserInput'] = ResolversParentTypes['CreateUserInput']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  createUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  deleteUser?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteUserArgs, 'id'>>;
  updateUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'id' | 'input'>>;
};

export type QueryResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  health?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<ReadonlyArray<ResolversTypes['User']>, ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  userUpdated?: SubscriptionResolver<ResolversTypes['User'], "userUpdated", ParentType, ContextType, RequireFields<SubscriptionUserUpdatedArgs, 'id'>>;
};

export type UpdateUserInputResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['UpdateUserInput'] = ResolversParentTypes['UpdateUserInput']> = {
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = import("../../server").GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = import("../../server").GraphQLContext> = {
  CreateUserInput?: CreateUserInputResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  UpdateUserInput?: UpdateUserInputResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};

