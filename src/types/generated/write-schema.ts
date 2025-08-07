export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: import("../branded").AggregateId; output: import("../branded").AggregateId; }
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
  readonly __typename: 'CreateUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
  readonly user: Maybe<User>;
};

export type DeleteUserPayload = {
  readonly __typename: 'DeleteUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
};

export type Error = {
  readonly __typename: 'Error';
  readonly field: Maybe<Scalars['String']['output']>;
  readonly message: Scalars['String']['output'];
};

export type Mutation = {
  readonly __typename: 'Mutation';
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
  readonly __typename: 'Query';
  readonly _empty: Maybe<Scalars['String']['output']>;
};

export type UpdateUserInput = {
  readonly email?: InputMaybe<Scalars['String']['input']>;
  readonly name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserPayload = {
  readonly __typename: 'UpdateUserPayload';
  readonly errors: Maybe<ReadonlyArray<Error>>;
  readonly success: Scalars['Boolean']['output'];
  readonly user: Maybe<User>;
};

export type User = {
  readonly __typename: 'User';
  readonly createdAt: Scalars['String']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly name: Scalars['String']['output'];
  readonly updatedAt: Scalars['String']['output'];
};
