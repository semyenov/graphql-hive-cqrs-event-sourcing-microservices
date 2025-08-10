#!/usr/bin/env bun

import { readPersistedDocuments } from '../src/graphql/persisted/read-documents';
import { writePersistedDocuments } from '../src/graphql/persisted/write-documents';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Combine all persisted documents
const allDocuments = [
  ...readPersistedDocuments,
  ...writePersistedDocuments,
];

// Generate manifest
const manifest: Record<string, string> = {};

allDocuments.forEach((doc: any) => {
  // Extract the document ID and query/mutation string
  const id = doc.id || doc.documentId || 'unknown';
  const query = doc.query || doc.document || '';
  
  manifest[id] = query;
});

// Write manifest to file
const manifestPath = join(process.cwd(), 'persisted-documents.json');
writeFileSync(
  manifestPath,
  JSON.stringify(manifest, null, 2)
);

console.log(`✅ Generated persisted documents manifest with ${Object.keys(manifest).length} documents`);
console.log(`📄 Manifest written to: ${manifestPath}`);