#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function ensureQueryExists(queryPath) {
  const fullPath = path.resolve(__dirname, queryPath);
  const contents = fs.readFileSync(fullPath, 'utf8');
  if (!contents.includes('query volumeUsage')) {
    throw new Error('volume_usage.gql does not contain expected query definition');
  }
}

try {
  ensureQueryExists(path.join('queries', 'volume_usage.gql'));
  console.log('✅ volume_usage.gql loaded successfully');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
