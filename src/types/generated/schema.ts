export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: import("../../core/branded").AggregateId; output: import("../../core/branded").AggregateId; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type CreateUserInput = {
  readonly __typename: 'CreateUserInput';
  readonly email: Scalars['String']['output'];
  readonly name: Scalars['String']['output'];
};

export type Mutation = {
  readonly __typename: 'Mutation';
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
  readonly __typename: 'Query';
  readonly health: Scalars['String']['output'];
  readonly user: Maybe<User>;
  readonly users: ReadonlyArray<User>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type Subscription = {
  readonly __typename: 'Subscription';
  readonly userUpdated: User;
};


export type SubscriptionUserUpdatedArgs = {
  id: Scalars['ID']['input'];
};

export type UpdateUserInput = {
  readonly __typename: 'UpdateUserInput';
  readonly email: Maybe<Scalars['String']['output']>;
  readonly name: Maybe<Scalars['String']['output']>;
};

export type User = {
  readonly __typename: 'User';
  readonly createdAt: Scalars['String']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly updatedAt: Scalars['String']['output'];
};
