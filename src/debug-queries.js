const { RailwayClient } = require('./query-railway');
const fs = require('fs');
const path = require('path');

async function testIndividualQueries() {
  console.log('🔍 Testing Railway GraphQL queries individually...\n');

  const token = process.env.RAILWAY_TOKEN;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;

  if (!token) {
    console.error('❌ RAILWAY_TOKEN environment variable is required');
    process.exit(1);
  }

  const client = new RailwayClient(token);

  // Test basic authentication first
  console.log('1. Testing basic authentication...');
  try {
    await client.makeGraphQLRequest('query { me { id name } }', {}, 'Basic Auth Test');
    console.log('✅ Authentication successful\n');
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.log('   This suggests your token is invalid or lacks permissions\n');
    return;
  }

  // Test volume query
  console.log('2. Testing volume sizes query...');
  const queriesDir = path.join(__dirname, '..', 'queries');
  try {
    const volumeQuery = fs.readFileSync(path.join(queriesDir, 'volume_sizes.gql'), 'utf8');
    await client.makeGraphQLRequest(volumeQuery, {}, 'Volume Sizes');
    console.log('✅ Volume query successful\n');
  } catch (error) {
    console.error('❌ Volume query failed:', error.message, '\n');
  }

  // Test deployment query
  console.log('3. Testing latest deployment query...');
  try {
    const deploymentQuery = fs.readFileSync(path.join(queriesDir, 'latest_deployment.gql'), 'utf8');
    await client.makeGraphQLRequest(deploymentQuery, { first: 1 }, 'Latest Deployments');
    console.log('✅ Deployment query successful\n');
  } catch (error) {
    console.error('❌ Deployment query failed:', error.message, '\n');
  }

  // Test event logs query (if environment ID provided)
  if (environmentId) {
    console.log('4. Testing event logs query...');
    try {
      const eventLogsQuery = fs.readFileSync(path.join(queriesDir, 'event_logs.gql'), 'utf8');
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      console.log(`📅 Date range: ${twentyFourHoursAgo} to ${now}`);
      await client.makeGraphQLRequest(eventLogsQuery, {
        environmentId: environmentId,
        startDate: twentyFourHoursAgo,
        endDate: now
      }, 'Event Logs');
      console.log('✅ Event logs query successful\n');
    } catch (error) {
      console.error('❌ Event logs query failed:', error.message, '\n');
    }
  } else {
    console.log('4. Skipping event logs query (no RAILWAY_ENVIRONMENT_ID set)\n');
  }

  console.log('🎯 Query testing complete!');
}

module.exports = { testIndividualQueries }; 