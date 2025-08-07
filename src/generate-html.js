const fs = require('fs');
const eventLogsConfig = require('./config/event-logs');

class DashboardGenerator {
  constructor() {
    this.data = null;
    // Get timezone from environment variable, default to UTC
    this.timezone = process.env.DISPLAY_TIMEZONE || 'UTC';
    
    // Validate timezone
    try {
      new Date().toLocaleString('en-US', { timeZone: this.timezone });
    } catch (error) {
      console.warn(`⚠️  Invalid timezone "${this.timezone}", falling back to UTC`);
      this.timezone = 'UTC';
    }
  }

  loadData(data) {
    try {
      this.data = data;
      return true;
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error.message);
      return false;
    }
  }

  formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: this.timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  formatEventTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: this.timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  extractEventAction(message) {
    const algorithm = eventLogsConfig.displayAlgorithm;
    const fallbackMaxLength = eventLogsConfig.fallback.maxLength;

    try {
      switch (algorithm) {
        case 'regex':
          const match = message.match(eventLogsConfig.displayRegex);
          if (match && match[1]) {
            return match[1];
          }
          // No match - use fallback
          return message.length > fallbackMaxLength 
            ? message.substring(0, fallbackMaxLength) + '...'
            : message;
        
        case 'custom':
          const result = eventLogsConfig.customDisplayFunction(message);
          return result || (message.length > fallbackMaxLength 
            ? message.substring(0, fallbackMaxLength) + '...'
            : message);
        
        default:
          console.warn(`Unknown display algorithm: ${algorithm}, falling back to regex`);
          const fallbackMatch = message.match(eventLogsConfig.displayRegex);
          return fallbackMatch && fallbackMatch[1] 
            ? fallbackMatch[1] 
            : message.substring(0, fallbackMaxLength) + '...';
      }
    } catch (error) {
      console.warn(`Error in display algorithm: ${error.message}, using fallback`);
      return message.length > fallbackMaxLength 
        ? message.substring(0, fallbackMaxLength) + '...'
        : message;
    }
  }

  escapeHtml(text) {
    const div = { innerHTML: '' };
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  extractComprehensiveData() {
    if (!this.data.success) {
      return { workspaces: [], volumes: [], eventLogs: [], hasFilters: false };
    }

    const workspaces = [];
    const volumes = [];
    let eventLogs = [];

    // Check if filters are applied
    const hasFilters = this.data.data.queryInfo?.filters?.projectId || 
                      this.data.data.queryInfo?.filters?.serviceId || 
                      this.data.data.queryInfo?.filters?.environmentId;

    // Get deployments mapped by service and environment for quick lookup
    const deploymentMap = new Map();
    if (this.data.data.deployments?.me?.workspaces) {
      for (const workspace of this.data.data.deployments.me.workspaces) {
        if (workspace.team?.projects?.edges) {
        for (const projectEdge of workspace.team.projects.edges) {
          const project = projectEdge.node;
            if (project.services?.edges) {
            for (const serviceEdge of project.services.edges) {
              const service = serviceEdge.node;
                if (service.deployments?.edges) {
                  for (const deploymentEdge of service.deployments.edges) {
                    const deployment = deploymentEdge.node;
                    const key = `${service.id}-${deployment.environmentId}`;
                    if (!deploymentMap.has(key) || 
                        new Date(deployment.createdAt) > new Date(deploymentMap.get(key).createdAt)) {
                      deploymentMap.set(key, deployment);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Process projects data to create nested structure
    if (this.data.data.projects?.me?.workspaces) {
      for (const workspace of this.data.data.projects.me.workspaces) {
        const workspaceData = {
          name: workspace.name,
          id: workspace.id,
          projects: []
        };

        if (workspace.team?.projects?.edges) {
          for (const projectEdge of workspace.team.projects.edges) {
            const project = projectEdge.node;
            const projectData = {
              id: project.id,
              name: project.name,
              description: project.description,
              teamId: project.teamId,
              createdAt: project.createdAt,
              services: [],
              environments: []
            };

            // Add services with their deployments
            if (project.services?.edges) {
              for (const serviceEdge of project.services.edges) {
                const service = serviceEdge.node;
                const serviceData = {
                  id: service.id,
                  name: service.name,
                  icon: service.icon,
                  createdAt: service.createdAt,
                  deployments: []
                };

                // Add deployments for each environment
                if (project.environments?.edges) {
                  for (const envEdge of project.environments.edges) {
                    const env = envEdge.node;
                    const deploymentKey = `${service.id}-${env.id}`;
                    const deployment = deploymentMap.get(deploymentKey);
                    
                    if (deployment) {
                      serviceData.deployments.push({
                        ...deployment,
                        environmentName: env.name,
                        environmentId: env.id
                      });
                    }
                  }
                }

                projectData.services.push(serviceData);
              }
            }

            // Add environments
            if (project.environments?.edges) {
              for (const envEdge of project.environments.edges) {
                const env = envEdge.node;
                projectData.environments.push({
                  id: env.id,
                  name: env.name,
                  isEphemeral: env.isEphemeral,
                  createdAt: env.createdAt
                });
              }
            }

            workspaceData.projects.push(projectData);
          }
        }

        workspaces.push(workspaceData);
      }
    }

    // Extract compact volume data
    if (this.data.data.volumes?.me?.workspaces) {
      for (const workspace of this.data.data.volumes.me.workspaces) {
        if (workspace.team?.projects?.edges) {
        for (const projectEdge of workspace.team.projects.edges) {
          const project = projectEdge.node;
            if (project.environments?.edges) {
            for (const envEdge of project.environments.edges) {
              const env = envEdge.node;
                if (env.volumeInstances?.edges) {
                for (const volumeEdge of env.volumeInstances.edges) {
                    const volume = volumeEdge.node;
                  volumes.push({
                      id: volume.id,
                      mountPath: volume.mountPath,
                      currentSizeMB: volume.currentSizeMB,
                      sizeMB: volume.sizeMB,
                      region: volume.region,
                      state: volume.state,
                      serviceName: volume.service?.name || 'Unknown Service',
                      environmentName: env.name,
                    projectName: project.name,
                      workspaceName: workspace.name
                  });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Extract event logs
    if (this.data.data.eventLogs && this.data.data.eventLogs.environmentLogs) {
      eventLogs = this.data.data.eventLogs.environmentLogs.map(log => ({
        timestamp: log.timestamp,
        message: log.message,
        severity: log.severity
      }));
      
      // Sort by timestamp (newest first)
      eventLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return { workspaces, volumes, eventLogs, hasFilters };
  }

  generateErrorHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Service Dashboard</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: white;
            color: black;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            font-size: 16px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid black;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .error {
            background-color:rgb(218, 218, 218);
            border: 2px solid black;
            padding: 15px;
            margin: 20px 0;
        }
        .timestamp {
            text-align: center;
            font-size: 0.9em;
            margin-top: 30px;
            border-top: 2px solid black;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚂 Railway Service Dashboard</h1>
        </div>
        
        <div class="error">
            <h2>⚠️ Railway API Unavailable</h2>
            <p><strong>Error:</strong> ${this.data.error.message}</p>
            <p><strong>Type:</strong> ${this.data.error.type}</p>
        </div>
        
        <div class="timestamp">
            Last updated: ${this.formatTimestamp(this.data.timestamp)}
        </div>
    </div>
</body>
</html>`;
  }

  generateComprehensiveHTML(workspaces, volumes, eventLogs, hasFilters) {
    // Helper function to get status indicator
    const getStatusIndicator = (status) => {
      const indicators = {
        'SUCCESS': 'OK',
        'BUILDING': 'BLD',
        'DEPLOYING': 'DEP',
        'FAILED': 'ERR',
        'CRASHED': 'CRS',
        'REMOVED': 'DEL',
        'SKIPPED': 'SKP'
      };
      return indicators[status] || 'UNK';
    };

    // Generate workspace title
    const workspaceTitle = hasFilters ? 
      (workspaces.length === 1 && workspaces[0].projects.length === 1 ? 
        workspaces[0].projects[0].name : 
        workspaces.map(w => w.name).join(', ')) :
      workspaces.map(w => w.name).join(', ');

    // Flatten all service+environment combinations for compact display
    const allServices = [];
    workspaces.forEach(workspace => {
      workspace.projects.forEach(project => {
        project.services.forEach(service => {
          // Create an entry for each environment the service is deployed to
          if (service.deployments.length > 0) {
            service.deployments.forEach(deployment => {
              allServices.push({
                workspaceName: workspace.name,
                projectName: project.name,
                serviceName: service.name,
                deployment: deployment,
                environmentName: deployment.environmentName
              });
            });
          } else {
            // If no deployments, still show the service
            allServices.push({
              workspaceName: workspace.name,
              projectName: project.name,
              serviceName: service.name,
              deployment: null,
              environmentName: 'N/A'
            });
          }
        });
      });
    });

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Dashboard - ${workspaceTitle}</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: white;
            color: black;
            margin: 0;
            padding: 6px;
            line-height: 1.2;
            font-size: 10px;
            width: 800px;
            height: 470px;
            overflow: hidden;
            box-sizing: border-box;
        }
        .header {
            border-bottom: 2px solid black;
            padding-bottom: 3px;
            margin-bottom: 6px;
            height: 40px;
            text-align: center;
        }
        .title {
            font-size: 14pt;
            font-weight: bold;
            margin: 0;
        }
        .subtitle {
            font-size: 9pt;
            margin: 0;
        }
        .main-layout {
            display: flex;
            gap: 8px;
            height: 85%;
        }
        .left-column {
            width: 50%;
        }
        .right-column {
            width: 50%;
        }
        .section {
            margin-bottom: 8px;
        }
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 3px;
            border-bottom: 2px solid black;
        }
        .service-box {
            border: 2px solid black;
            padding: 4px;
            margin-bottom: 3px;
            font-size: 10pt;
        }
        .service-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }
        .service-name {
            font-weight: bold;
            font-size: 10pt;
        }
        .service-info {
            font-size: 10pt;
            margin-top: 2px;
        }
        .status {
            padding: 1px 3px;
            font-size: 10pt;
            font-weight: bold;
        }
        .status-success { background-color: black; color: white; }
        .status-building { background-color: white; color: black; border: 1px solid black; }
        .status-deploying { background-color: black; color: white; }
        .status-failed { background-color: black; color: white; }
        .status-crashed { background-color: black; color: white; }
        .status-removed { background-color: white; color: black; border: 1px solid black; }
        .status-skipped { background-color: white; color: black; border: 1px solid black; }
        .status-none { background-color: white; color: black; border: 1px dashed black; }
        .volume-box {
            border: 2px solid black;
            padding: 3px;
            margin-bottom: 2px;
            font-size: 10pt;
        }
        .volume-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1px;
        }
        .volume-details {
            font-weight: bold;
            font-size: 10pt;
        }
        .volume-usage {
            font-size: 10pt;
        }
        .volume-path {
            font-size: 10pt;
            margin-top: 1px;
        }
        .event-list {
            height: 300px;
            overflow: hidden;
        }
        .event-item {
            padding: 2px 0;
            border-bottom: 2px dotted black;
            font-size: 10pt;
            margin-bottom: 2px;
        }
        .event-item.error {
            border-left: 2px solid black;
            padding-left: 3px;
        }
        .event-item.warn {
            border-left: 2px dashed black;
            padding-left: 3px;
        }
        .event-item.info {
            border-left: 1px solid black;
            padding-left: 3px;
        }
        .event-time {
            font-weight: bold;
            font-size: 10pt;
        }
        .event-message {
            margin-top: 1px;
            line-height: 1.1;
        }
        .timestamp {
            height: 20px;
            text-align: center;
            margin-top: 6px;
            padding-top: 3px;
            border-top: 2px dotted black;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Railway Dashboard</div>
        <div class="subtitle">${workspaceTitle}${hasFilters ? ' (Filtered)' : ''}</div>
    </div>

    <div class="main-layout">
        <div class="left-column">
            ${allServices.length > 0 ? `
                <div class="section">
                    <div class="section-title">Services</div>
                    ${allServices.slice(0, 12).map(service => {
                      const deployment = service.deployment;
                      const statusIndicator = deployment ? getStatusIndicator(deployment.status) : 'NONE';
                      const statusClass = deployment ? `status-${deployment.status.toLowerCase()}` : 'status-none';
                      const envName = service.environmentName;
                      const timeStr = deployment ? this.formatTimestamp(deployment.createdAt) : '';
                      
                      return `
                        <div class="service-box">
                            <div class="service-header">
                                <span class="service-name">${hasFilters ? service.serviceName : `${service.projectName}/${service.serviceName}`}</span>
                                <span class="status ${statusClass}">${statusIndicator}</span>
                            </div>
                            <div class="service-info">
                                ${envName} • ${timeStr || 'No deployment'}
                            </div>
                        </div>
                      `;
                    }).join('')}
                </div>
            ` : ''}

            ${!this.data.data.eventLogsEnvironmentId && volumes.length > 0 ? `
                <div class="section">
                    <div class="section-title">Volumes</div>
                    ${volumes.slice(0, 8).map(volume => {
                      const usagePercent = ((volume.currentSizeMB / volume.sizeMB) * 100).toFixed(0);
                      const currentGB = (volume.currentSizeMB / 1024).toFixed(1);
                      const maxGB = (volume.sizeMB / 1024).toFixed(1);
                      
                      return `
                        <div class="volume-box">
                            <div class="volume-header">
                                <span class="volume-details">${volume.serviceName} • ${volume.environmentName}</span>
                                <span class="volume-usage">${currentGB}/${maxGB}GB (${usagePercent}%)</span>
                            </div>
                            <div class="volume-path">${volume.mountPath}</div>
                        </div>
                      `;
                    }).join('')}
                </div>
            ` : ''}
        </div>

        <div class="right-column">
            ${this.data.data.eventLogsEnvironmentId ? `
                ${eventLogs.length > 0 ? `
                    <div class="section">
                        <div class="section-title">Recent Events</div>
                        <div style="font-size: 10pt; margin-bottom: 4px; opacity: 0.8;">
                            ${(() => {
                                // Find the service and environment name for the event logs environment
                                const logsEnvId = this.data.data.eventLogsEnvironmentId;
                                for (const workspace of workspaces) {
                                    for (const project of workspace.projects) {
                                        for (const service of project.services) {
                                            for (const deployment of service.deployments) {
                                                if (deployment.environmentId === logsEnvId) {
                                                    return `${service.name} • ${deployment.environmentName}`;
                                                }
                                            }
                                        }
                                    }
                                }
                                return `Environment: ${logsEnvId}`;
                            })()}
                        </div>
                        <div class="event-list">
                            ${eventLogs.slice(0, 8).map(log => `
                                <div class="event-item ${log.severity}">
                                    <div class="event-time">${this.formatEventTimestamp(log.timestamp)}</div>
                                    <div class="event-message">${this.escapeHtml(this.extractEventAction(log.message))}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="section">
                        <div class="section-title">Recent Events</div>
                        <div style="font-size: 8px; margin-bottom: 4px; opacity: 0.8;">
                            ${(() => {
                                // Find the service and environment name for the event logs environment
                                const logsEnvId = this.data.data.eventLogsEnvironmentId;
                                for (const workspace of workspaces) {
                                    for (const project of workspace.projects) {
                                        for (const service of project.services) {
                                            for (const deployment of service.deployments) {
                                                if (deployment.environmentId === logsEnvId) {
                                                    return `${service.name} • ${deployment.environmentName}`;
                                                }
                                            }
                                        }
                                    }
                                }
                                return `Environment: ${logsEnvId}`;
                            })()}
                        </div>
                        <div style="font-size: 8px;">No recent events</div>
                    </div>
                `}
            ` : volumes.length > 0 ? `
                <div class="section">
                    <div class="section-title">Volumes</div>
                    ${volumes.slice(0, 8).map(volume => {
                      const usagePercent = ((volume.currentSizeMB / volume.sizeMB) * 100).toFixed(0);
                      const currentGB = (volume.currentSizeMB / 1024).toFixed(1);
                      const maxGB = (volume.sizeMB / 1024).toFixed(1);

                      return `
                        <div class="volume-box">
                            <div class="volume-header">
                                <span class="volume-details">${volume.serviceName} • ${volume.environmentName}</span>
                                <span class="volume-usage">${currentGB}/${maxGB}GB (${usagePercent}%)</span>
                            </div>
                            <div class="volume-path">${volume.mountPath}</div>
                        </div>
                      `;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    </div>

    <div class="timestamp">
        Updated: ${this.formatTimestamp(this.data.timestamp)}
    </div>
</body>
</html>`;
  }

  generateHTML() {
    if (!this.data) {
      throw new Error('No data loaded. Call loadData() first.');
    }

    if (!this.data.success) {
      return this.generateErrorHTML();
    }

    const { workspaces, volumes, eventLogs, hasFilters } = this.extractComprehensiveData();
    return this.generateComprehensiveHTML(workspaces, volumes, eventLogs, hasFilters);
  }
}

module.exports = { DashboardGenerator }; 