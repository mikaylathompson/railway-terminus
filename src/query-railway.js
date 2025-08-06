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

  // Helper function to filter Railway API data based on project, service, and environment IDs
  filterData(data, filters) {
    if (!data || !data.me || !data.me.workspaces || !filters) {
      return data;
    }

    const { projectId, serviceId, environmentId } = filters;
    
    // If no filters are provided, return original data
    if (!projectId && !serviceId && !environmentId) {
      return data;
    }

    const filteredData = {
      ...data,
      me: {
        ...data.me,
        workspaces: data.me.workspaces.map(workspace => ({
          ...workspace,
          team: {
            ...workspace.team,
            projects: {
              ...workspace.team.projects,
              edges: workspace.team.projects.edges.filter(projectEdge => {
                const project = projectEdge.node;
                
                // Filter by project ID if specified
                if (projectId && project.id !== projectId) {
                  return false;
                }
                
                return true;
              }).map(projectEdge => ({
                ...projectEdge,
                node: {
                  ...projectEdge.node,
                  services: projectEdge.node.services ? {
                    ...projectEdge.node.services,
                    edges: projectEdge.node.services.edges.filter(serviceEdge => {
                      const service = serviceEdge.node;
                      
                      // Filter by service ID if specified
                      if (serviceId && service.id !== serviceId) {
                        return false;
                      }
                      
                      return true;
                    }).map(serviceEdge => ({
                      ...serviceEdge,
                      node: {
                        ...serviceEdge.node,
                        deployments: serviceEdge.node.deployments ? {
                          ...serviceEdge.node.deployments,
                          edges: serviceEdge.node.deployments.edges.filter(deploymentEdge => {
                            const deployment = deploymentEdge.node;
                            
                            // Filter by environment name/ID if specified
                            if (environmentId && deployment.environment && deployment.environment.name !== environmentId) {
                              return false;
                            }
                            
                            return true;
                          })
                        } : serviceEdge.node.deployments
                      }
                    }))
                  } : projectEdge.node.services,
                  environments: projectEdge.node.environments ? {
                    ...projectEdge.node.environments,
                    edges: projectEdge.node.environments.edges.filter(envEdge => {
                      const environment = envEdge.node;
                      
                      // Filter by environment name/ID if specified
                      if (environmentId && environment.name !== environmentId && environment.id !== environmentId) {
                        return false;
                      }
                      
                      return true;
                    })
                  } : projectEdge.node.environments
                }
              }))
            }
          }
        }))
      }
    };

    return filteredData;
  }

  // Specific filtering methods for comprehensive queries
  filterProjectsData(data, filters) {
    if (!data?.me?.workspaces || !filters) return data;
    
    const { projectId, serviceId } = filters;
    if (!projectId && !serviceId) return data;

    const filteredData = {
      ...data,
      me: {
        ...data.me,
        workspaces: data.me.workspaces.map(workspace => ({
          ...workspace,
          team: {
            ...workspace.team,
            projects: {
              ...workspace.team.projects,
              edges: workspace.team.projects.edges.filter(projectEdge => {
                const project = projectEdge.node;
                
                // Filter by project ID if specified
                if (projectId && project.id !== projectId) {
                  return false;
                }
                
                return true;
              }).map(projectEdge => ({
                ...projectEdge,
                node: {
                  ...projectEdge.node,
                  services: projectEdge.node.services ? {
                    ...projectEdge.node.services,
                    edges: projectEdge.node.services.edges.filter(serviceEdge => {
                      const service = serviceEdge.node;
                      
                      // Filter by service ID if specified
                      if (serviceId && service.id !== serviceId) {
                        return false;
                      }
                      
                      return true;
                    })
                  } : projectEdge.node.services
                }
              }))
            }
          }
        }))
      }
    };

    return filteredData;
  }

  filterDeploymentsData(data, filters) {
    if (!data?.deployments?.edges || !filters) return data;
    
    const { projectId, serviceId, environmentId } = filters;
    if (!projectId && !serviceId && !environmentId) return data;

    const filteredData = {
      ...data,
      deployments: {
        ...data.deployments,
        edges: data.deployments.edges.filter(deploymentEdge => {
          const deployment = deploymentEdge.node;
          
          // Filter by project ID if specified
          if (projectId && deployment.projectId !== projectId) {
            return false;
          }
          
          // Filter by service ID if specified
          if (serviceId && deployment.serviceId !== serviceId) {
            return false;
          }
          
          // Filter by environment ID if specified
          if (environmentId && deployment.environmentId !== environmentId) {
            return false;
          }
          
          return true;
        })
      }
    };

    return filteredData;
  }

  filterVolumesData(data, filters) {
    if (!data?.me?.workspaces || !filters) return data;
    
    const { projectId, serviceId, environmentId } = filters;
    if (!projectId && !serviceId && !environmentId) return data;

    const filteredData = {
      ...data,
      me: {
        ...data.me,
        workspaces: data.me.workspaces.map(workspace => ({
          ...workspace,
          team: {
            ...workspace.team,
            projects: {
              ...workspace.team.projects,
              edges: workspace.team.projects.edges.filter(projectEdge => {
                const project = projectEdge.node;
                
                // Filter by project ID if specified
                if (projectId && project.id !== projectId) {
                  return false;
                }
                
                return true;
              }).map(projectEdge => ({
                ...projectEdge,
                node: {
                  ...projectEdge.node,
                  environments: projectEdge.node.environments ? {
                    ...projectEdge.node.environments,
                    edges: projectEdge.node.environments.edges.filter(envEdge => {
                      const environment = envEdge.node;
                      
                      // Filter by environment ID if specified
                      if (environmentId && environment.id !== environmentId) {
                        return false;
                      }
                      
                      return true;
                    }).map(envEdge => ({
                      ...envEdge,
                      node: {
                        ...envEdge.node,
                        volumeInstances: envEdge.node.volumeInstances ? {
                          ...envEdge.node.volumeInstances,
                          edges: envEdge.node.volumeInstances.edges.filter(volEdge => {
                            const volume = volEdge.node;
                            
                            // Filter by service ID if specified
                            if (serviceId && volume.serviceId !== serviceId) {
                              return false;
                            }
                            
                            return true;
                          })
                        } : envEdge.node.volumeInstances
                      }
                    }))
                  } : projectEdge.node.environments
                }
              }))
            }
          }
        }))
      }
    };

    return filteredData;
  }

  async fetchDashboardData(terminusLogsEnvId = null, filters = {}) {
    try {
      const { projectId, serviceId, environmentId } = filters;
      
      // Log filtering parameters
      if (projectId || serviceId || environmentId) {
        console.log(`📊 Applying filters - Project: ${projectId || 'all'}, Service: ${serviceId || 'all'}, Environment: ${environmentId || 'all'}`);
      }
      
      if (terminusLogsEnvId) {
        console.log(`📋 Event logs enabled for environment: ${terminusLogsEnvId}`);
      }
      
      console.log('📡 Querying Railway API...');
      
      // Read GraphQL queries from the queries directory
      const queriesDir = path.join(__dirname, '..', 'queries');
      const projectsQuery = fs.readFileSync(path.join(queriesDir, 'projects_services_environments.gql'), 'utf8');
      const deploymentsQuery = fs.readFileSync(path.join(queriesDir, 'latest_deployments.gql'), 'utf8');
      const volumeQuery = fs.readFileSync(path.join(queriesDir, 'volume_usage.gql'), 'utf8');
      const eventLogsQuery = fs.readFileSync(path.join(queriesDir, 'event_logs.gql'), 'utf8');
      
      // Get event logs configuration
      const maxEntries = eventLogsConfig.maxLogEntries;
      const logFilter = eventLogsConfig.logFilter;
      
      // Execute comprehensive queries
      let projectsData;
      let deploymentsData;
      let volumeData;
      let queryErrors = [];

      // Projects, Services, and Environments query
      try {
        projectsData = await this.makeGraphQLRequest(projectsQuery, {}, 'Projects, Services, and Environments');
      } catch (error) {
        console.error('❌ Projects query failed:', error.message);
        projectsData = { me: { workspaces: [] } };
        queryErrors.push('Projects query failed');
      }

      // Latest Deployments query
      try {
        deploymentsData = await this.makeGraphQLRequest(deploymentsQuery, { first: 4 }, 'Latest Deployments');
      } catch (error) {
        console.error('❌ Deployments query failed:', error.message);
        deploymentsData = { deployments: { edges: [] } };
        queryErrors.push('Deployments query failed');
      }

      // Volume Usage query
      try {
        volumeData = await this.makeGraphQLRequest(volumeQuery, {}, 'Volume Usage');
      } catch (error) {
        console.error('❌ Volumes query failed:', error.message);
        volumeData = { me: { workspaces: [] } };
        queryErrors.push('Volumes query failed');
      }
      
      // Try event logs query if terminus logs environment ID is provided
      let eventLogsData = null;
      let eventLogsQueryUsed = 'none';
      if (terminusLogsEnvId) {
        console.log(`📋 Including event logs for environment: ${terminusLogsEnvId}`);
        try {
          eventLogsData = await this.makeGraphQLRequest(eventLogsQuery, {
            environmentId: terminusLogsEnvId,
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
        console.log('⚠️  No TERMINUS_LOGS_ENV_ID provided, skipping event logs');
        eventLogsData = { environmentLogs: [] };
        eventLogsQueryUsed = 'skipped';
      }
      
      // Apply filtering to the comprehensive data if filters are provided
      const filteredProjectsData = this.filterProjectsData(projectsData, filters);
      const filteredDeploymentsData = this.filterDeploymentsData(deploymentsData, filters);
      const filteredVolumeData = this.filterVolumesData(volumeData, filters);
      
      // Process and combine data
      const dashboardData = {
        timestamp: new Date().toISOString(),
        success: true,
        data: {
          projects: filteredProjectsData,
          deployments: filteredDeploymentsData,
          volumes: filteredVolumeData,
          eventLogs: eventLogsData,
          eventLogsEnvironmentId: terminusLogsEnvId,
          eventLogsConfig: {
            maxEntries: maxEntries,
            filter: logFilter
          },
          queryInfo: {
            errors: queryErrors,
            eventLogsQueryUsed
          }
        }
      };
      
      console.log('✅ Successfully fetched Railway data');
      if (queryErrors.length > 0) {
        console.log(`   Query errors: ${queryErrors.join(', ')}`);
      }
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