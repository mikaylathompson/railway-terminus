const https = require('https');
const fs = require('fs');
const path = require('path');
const eventLogsConfig = require('./config/event-logs');

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

class RailwayClient {
  constructor(token) {
    if (!token) {
      throw new Error('RAILWAY_TOKEN is required');
    }
    this.token = token;
  }

  async makeGraphQLRequest(query, variables = {}, queryName = 'Unknown') {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        query: query,
        variables: variables
      });
      
      console.log(`🔍 Executing ${queryName} query...`);
      
      const options = {
        hostname: 'backboard.railway.com',
        port: 443,
        path: '/graphql/v2',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'Content-Length': data.length
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (parsed.errors) {
              const errorMessages = parsed.errors.map(err => err.message).join(', ');
              reject(new Error(`${queryName} query failed - Railway API Error: ${errorMessages}. Response: ${responseData}`));
            } else {
              console.log(`✅ ${queryName} query successful`);
              resolve(parsed.data);
            }
          } catch (e) {
            reject(new Error(`${queryName} query failed - Failed to parse response: ${e.message}. Raw response: ${responseData.substring(0, 200)}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`${queryName} query failed - Network error: ${error.message}`));
      });
      
      req.write(data);
      req.end();
    });
  }

  async fetchDashboardData(environmentId = null, lookbackHours = 24) {
    try {
      console.log('📡 Querying Railway API...');
      
      // Read GraphQL queries from the queries directory
      const queriesDir = path.join(__dirname, '..', 'queries');
      const volumeQuery = fs.readFileSync(path.join(queriesDir, 'volume_sizes.gql'), 'utf8');
      const deploymentQuery = fs.readFileSync(path.join(queriesDir, 'latest_deployment.gql'), 'utf8');
      const eventLogsQuery = fs.readFileSync(path.join(queriesDir, 'event_logs.gql'), 'utf8');
      
      // Get event logs configuration
      const maxEntries = eventLogsConfig.maxLogEntries;
      const logFilter = eventLogsConfig.logFilter;
      
      // Try deployment query first (this usually works)
      let deploymentData;
      try {
        deploymentData = await this.makeGraphQLRequest(deploymentQuery, { first: 1 }, 'Latest Deployments');
      } catch (error) {
        console.error('❌ Deployment query failed:', error.message);
        deploymentData = { me: { workspaces: [] } }; // Empty fallback
      }
      
      // Try volume query - should work now with exact query
      let volumeData;
      let volumeQueryUsed = 'none';
      try {
        volumeData = await this.makeGraphQLRequest(volumeQuery, {}, 'Volume Sizes');
        volumeQueryUsed = 'full';
      } catch (error) {
        console.error('❌ Volume query failed:', error.message);
        volumeData = { me: { workspaces: [] } }; // Empty fallback
        volumeQueryUsed = 'empty';
      }
      
      // Try event logs query - should work now with exact query
      let eventLogsData = null;
      let eventLogsQueryUsed = 'none';
      if (environmentId) {
        console.log(`📋 Including event logs for environment: ${environmentId}`);
        try {
          eventLogsData = await this.makeGraphQLRequest(eventLogsQuery, {
            environmentId: environmentId,
            filter: logFilter,
            afterLimit: maxEntries
          }, 'Event Logs');
          eventLogsQueryUsed = 'full';
        } catch (error) {
          console.error('❌ Event logs query failed:', error.message);
          eventLogsData = { environmentLogs: [] }; // Empty fallback
          eventLogsQueryUsed = 'empty';
        }
      } else {
        console.log('⚠️  No environment ID provided, skipping event logs');
        eventLogsData = { environmentLogs: [] };
        eventLogsQueryUsed = 'skipped';
      }
      
      // Process and combine data
      const dashboardData = {
        timestamp: new Date().toISOString(),
        success: true,
        data: {
          volumes: volumeData,
          deployments: deploymentData,
                  eventLogs: eventLogsData,
        eventLogsEnvironmentId: environmentId,
        eventLogsConfig: {
          maxEntries: maxEntries,
          filter: logFilter
        },
          lookbackHours: lookbackHours,
          queryInfo: {
            volumeQueryUsed,
            eventLogsQueryUsed
          }
        }
      };
      
      console.log('✅ Successfully fetched Railway data');
      console.log(`   Volume query: ${volumeQueryUsed}`);
      console.log(`   Event logs query: ${eventLogsQueryUsed}`);
      return dashboardData;
      
    } catch (error) {
      console.error('❌ Error fetching Railway data:', error.message);
      
      return {
        timestamp: new Date().toISOString(),
        success: false,
        error: {
          message: error.message,
          type: 'API_ERROR'
        }
      };
    }
  }
}

module.exports = { RailwayClient }; 