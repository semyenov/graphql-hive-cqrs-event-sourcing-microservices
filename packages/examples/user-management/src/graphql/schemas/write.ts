// Using makeExecutableSchema instead of buildSchema for better compatibility
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';

const writeSchemaGQL = readFileSync(join(__dirname, 'write.graphql'), 'utf-8');

export const writeSchema = makeExecutableSchema({
  typeDefs: writeSchemaGQL,
});