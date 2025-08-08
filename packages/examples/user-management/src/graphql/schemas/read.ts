// Using makeExecutableSchema instead of buildSchema for better compatibility
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

const readSchemaGQL = readFileSync(join(__dirname, 'read.graphql'), 'utf-8');

export const readSchema = makeExecutableSchema({
  typeDefs: readSchemaGQL,
});