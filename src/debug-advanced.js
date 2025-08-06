const { RailwayClient } = require('./query-railway');
const fs = require('fs');
const path = require('path');

async function debugAdvanced() {
  console.log('🔬 Advanced Railway API Debugging...\n');

  const token = process.env.RAILWAY_TOKEN;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;

  if (!token) {
    console.error('❌ RAILWAY_TOKEN environment variable is required');
    process.exit(1);
  }

  const client = new RailwayClient(token);

  // Test 1: Basic user info
  console.log('1. Testing user authentication and basic info...');
  try {
    const userData = await client.makeGraphQLRequest('query { me { id name email } }', {}, 'User Info');
    console.log('✅ User authenticated:', userData.me.name);
    console.log('   User ID:', userData.me.id);
    console.log('   Email:', userData.me.email, '\n');
  } catch (error) {
    console.error('❌ User authentication failed:', error.message, '\n');
    return;
  }

  // Test 2: List workspaces
  console.log('2. Testing workspace access...');
  try {
    const workspaceData = await client.makeGraphQLRequest(`
      query {
        me {
          workspaces {
            name
            id
            team {
              name
              id
            }
          }
        }
      }
    `, {}, 'Workspaces');
    
    console.log('✅ Workspaces found:', workspaceData.me.workspaces.length);
    workspaceData.me.workspaces.forEach(ws => {
      console.log(`   - ${ws.name} (${ws.id})`);
      if (ws.team) {
        console.log(`     Team: ${ws.team.name} (${ws.team.id})`);
      }
    });
    console.log('');
  } catch (error) {
    console.error('❌ Workspace query failed:', error.message, '\n');
  }

  // Test 3: List projects
  console.log('3. Testing project access...');
  try {
    const projectData = await client.makeGraphQLRequest(`
      query {
        me {
          workspaces {
            name
            team {
              projects {
                edges {
                  node {
                    id
                    name
                    environments {
                      edges {
                        node {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, {}, 'Projects');
    
    let projectCount = 0;
    let envCount = 0;
    projectData.me.workspaces.forEach(ws => {
      if (ws.team && ws.team.projects) {
        ws.team.projects.edges.forEach(projectEdge => {
          const project = projectEdge.node;
          projectCount++;
          console.log(`   - Project: ${project.name} (${project.id})`);
          if (project.environments) {
            project.environments.edges.forEach(envEdge => {
              const env = envEdge.node;
              envCount++;
              console.log(`     Environment: ${env.name} (${env.id})`);
            });
          }
        });
      }
    });
    console.log(`✅ Found ${projectCount} projects and ${envCount} environments\n`);
  } catch (error) {
    console.error('❌ Project query failed:', error.message, '\n');
  }

  // Test 4: Test volume access with different approaches
  console.log('4. Testing volume access...');
  const volumeQueries = [
    {
      name: 'Basic Volume Query',
      query: `
        query {
          me {
            workspaces {
              team {
                projects {
                  edges {
                    node {
                      environments {
                        edges {
                          node {
                            volumeInstances {
                              edges {
                                node {
                                  id
                                  name
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    },
    {
      name: 'Volume with Size Info',
      query: `
        query {
          me {
            workspaces {
              team {
                projects {
                  edges {
                    node {
                      environments {
                        edges {
                          node {
                            volumeInstances {
                              edges {
                                node {
                                  id
                                  name
                                  sizeMB
                                  currentSizeMB
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    }
  ];

  for (const queryTest of volumeQueries) {
    try {
      console.log(`   Testing: ${queryTest.name}...`);
      const result = await client.makeGraphQLRequest(queryTest.query, {}, queryTest.name);
      console.log(`   ✅ ${queryTest.name} successful`);
      
      // Count volumes
      let volumeCount = 0;
      result.me.workspaces.forEach(ws => {
        if (ws.team && ws.team.projects) {
          ws.team.projects.edges.forEach(projectEdge => {
            if (projectEdge.node.environments) {
              projectEdge.node.environments.edges.forEach(envEdge => {
                if (envEdge.node.volumeInstances) {
                  volumeCount += envEdge.node.volumeInstances.edges.length;
                }
              });
            }
          });
        }
      });
      console.log(`   Found ${volumeCount} volumes`);
    } catch (error) {
      console.log(`   ❌ ${queryTest.name} failed:`, error.message);
    }
  }
  console.log('');

  // Test 5: Test event logs with different approaches
  if (environmentId) {
    console.log('5. Testing event logs access...');
    const eventQueries = [
      {
        name: 'Event Logs with Date Range',
        query: `
          query EventLogsTest($environmentId: ID!, $startDate: DateTime!, $endDate: DateTime!) {
            environmentLogs(environmentId: $environmentId, startDate: $startDate, endDate: $endDate) {
              timestamp
              message
              severity
            }
          }
        `,
        variables: {
          environmentId: environmentId,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      },
      {
        name: 'Event Logs Simple',
        query: `
          query EventLogsSimpleTest($environmentId: ID!) {
            environmentLogs(environmentId: $environmentId, first: 10) {
              edges {
                node {
                  timestamp
                  message
                  severity
                }
              }
            }
          }
        `,
        variables: {
          environmentId: environmentId
        }
      }
    ];

    for (const queryTest of eventQueries) {
      try {
        console.log(`   Testing: ${queryTest.name}...`);
        const result = await client.makeGraphQLRequest(queryTest.query, queryTest.variables, queryTest.name);
        console.log(`   ✅ ${queryTest.name} successful`);
        
        // Count logs
        let logCount = 0;
        if (result.environmentLogs) {
          if (Array.isArray(result.environmentLogs)) {
            logCount = result.environmentLogs.length;
          } else if (result.environmentLogs.edges) {
            logCount = result.environmentLogs.edges.length;
          }
        }
        console.log(`   Found ${logCount} log entries`);
      } catch (error) {
        console.log(`   ❌ ${queryTest.name} failed:`, error.message);
      }
    }
    console.log('');
  } else {
    console.log('5. Skipping event logs test (no RAILWAY_ENVIRONMENT_ID set)\n');
  }

  console.log('🎯 Advanced debugging complete!');
  console.log('\n💡 Recommendations:');
  console.log('   - If volume queries fail, check if you have volumes in your projects');
  console.log('   - If event logs fail, verify the environment ID is correct');
  console.log('   - Some queries may require specific permissions in Railway');
  console.log('   - Try using the simple query versions as fallbacks');
}

module.exports = { debugAdvanced }; 