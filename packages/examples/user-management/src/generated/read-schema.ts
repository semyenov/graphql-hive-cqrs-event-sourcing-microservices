export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: import("@cqrs-framework/core").AggregateId; output: import("@cqrs-framework/core").AggregateId; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Query = {
  readonly __typename: 'Query';
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

export type User = {
  readonly __typename: 'User';
  readonly createdAt: Scalars['String']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly updatedAt: Scalars['String']['output'];
};

export type UserList = {
  readonly __typename: 'UserList';
  readonly hasMore: Scalars['Boolean']['output'];
  readonly total: Scalars['Int']['output'];
  readonly users: ReadonlyArray<User>;
};
