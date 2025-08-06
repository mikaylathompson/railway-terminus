const fs = require('fs');

class DashboardGenerator {
  constructor() {
    this.data = null;
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
      timeZone: 'UTC',
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  extractEventAction(message) {
    // Extract text between square brackets, e.g., "[REPORT-GENERATED]" from message
    const match = message.match(/\[([^\]]+)\]/);
    return match ? match[1] : message.substring(0, 20) + '...';
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

  extractProjectData() {
    if (!this.data.success) {
      return { services: [], volumes: [], eventLogs: [] };
    }

    const services = [];
    const volumes = [];
    let eventLogs = [];

    // Extract services and deployments
    const deploymentWorkspaces = this.data.data.deployments.me.workspaces;
    for (const workspace of deploymentWorkspaces) {
      if (workspace.team && workspace.team.projects) {
        for (const projectEdge of workspace.team.projects.edges) {
          const project = projectEdge.node;
          if (project.services) {
            for (const serviceEdge of project.services.edges) {
              const service = serviceEdge.node;
              services.push({
                workspaceName: workspace.name,
                projectName: project.name,
                serviceName: service.name,
                serviceId: service.id,
                deployment: service.deployments.edges.length > 0 ? service.deployments.edges[0].node : null
              });
            }
          }
        }
      }
    }

    // Extract volume data
    const volumeWorkspaces = this.data.data.volumes.me.workspaces;
    for (const workspace of volumeWorkspaces) {
      if (workspace.team && workspace.team.projects) {
        for (const projectEdge of workspace.team.projects.edges) {
          const project = projectEdge.node;
          if (project.environments) {
            for (const envEdge of project.environments.edges) {
              const env = envEdge.node;
              if (env.volumeInstances && env.volumeInstances.edges.length > 0) {
                for (const volumeEdge of env.volumeInstances.edges) {
                  volumes.push({
                    workspaceName: workspace.name,
                    projectName: project.name,
                    environmentName: env.name,
                    ...volumeEdge.node
                  });
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

    return { services, volumes, eventLogs };
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
            background-color: #f0f0f0;
            border: 2px solid black;
            padding: 15px;
            margin: 20px 0;
        }
        .timestamp {
            text-align: center;
            font-size: 0.9em;
            margin-top: 30px;
            border-top: 1px solid black;
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

  generateSuccessHTML(services, volumes, eventLogs) {
    const workspaceName = services.length > 0 ? services[0].workspaceName : 'Unknown';
    const projectName = services.length > 0 ? services[0].projectName : 'Unknown';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=800, initial-scale=1.0">
    <title>Railway Dashboard</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: white;
            color: black;
            margin: 0;
            padding: 16px;
            line-height: 1.2;
            font-size: 14px;
            width: 800px;
            height: 470px;
            overflow: hidden;
            box-sizing: border-box;
        }
        .container {
            width: 95%;
            height: 95%;
            display: flex;
            flex-direction: column;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid black;
            padding: 6px 0;
            margin-bottom: 12px;
        }
        .header h1 {
            margin: 0;
            font-size: 16px;
            font-weight: bold;
        }
        .header p {
            margin: 3px 0 0 0;
            font-size: 11px;
        }
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            flex: 1;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .left-panel, .right-panel {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .section {
            border: 1px solid black;
            padding: 8px;
            background-color: white;
        }
        .section-title {
            font-size: 13px;
            font-weight: bold;
            margin: 0 0 6px 0;
            border-bottom: 1px solid black;
            padding-bottom: 3px;
        }
        .services-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
        }
        .service-box {
            border: 1px solid black;
            padding: 6px;
            font-size: 10px;
        }
        .service-box.error {
            background-color: #eee;
            border: 2px solid black;
        }
        .service-name {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 3px;
        }
        .service-status {
            margin: 1px 0;
        }
        .status-success {
            font-weight: bold;
        }
        .status-error {
            font-weight: bold;
            text-decoration: underline;
        }
        .volumes-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            font-size: 10px;
        }
        .volume-box {
            border: 1px solid black;
            padding: 6px;
        }
        .volume-usage {
            font-weight: bold;
            font-size: 11px;
        }
        .logs-section {
            flex: 1;
            overflow: hidden;
        }
        .logs-container {
            height: 90%;
            overflow-y: auto;
            border: 1px solid black;
            background-color: white;
            font-size: 10px;
        }
        .log-entry {
            padding: 3px 6px;
            border-bottom: 1px solid #ddd;
            line-height: 1.2;
        }
        .log-entry.ERROR {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .log-entry.WARN {
            background-color: #f8f8f8;
        }
        .log-time {
            font-size: 10px;
            margin-bottom: 1px;
        }
        .log-msg {
            word-break: break-word;
            font-weight: bold;
        }
        .timestamp {
            text-align: center;
            font-size: 10px;
            padding: 6px 0;
            border-top: 1px solid black;
            margin-top: auto;
        }
        .compact-info {
            font-size: 10px;
            line-height: 1.2;
        }
        .info-row {
            display: grid;
            grid-template-columns: 45px 1fr;
            gap: 6px;
            margin: 2px 0;
        }
        .info-label {
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Railway Dashboard</h1>
            <p>${workspaceName} / ${projectName}</p>
        </div>
        
        <div class="main-content">
            <div class="left-panel">
        
                ${services.length > 0 ? `
                <div class="section">
                    <div class="section-title">Services (${services.length})</div>
                    <div class="services-grid">
                        ${services.slice(0, 6).map(service => `
                        <div class="service-box ${!service.deployment || service.deployment.status !== 'SUCCESS' ? 'error' : ''}">
                            <div class="service-name">${service.serviceName}</div>
                            ${service.deployment ? `
                            <div class="service-status">
                                <span class="${service.deployment.status === 'SUCCESS' ? 'status-success' : 'status-error'}">${service.deployment.status}</span>
                            </div>
                            <div class="compact-info">
                                <div>${service.deployment.environment.name}</div>
                                <div>${this.formatEventTimestamp(service.deployment.createdAt)}</div>
                            </div>
                            ` : '<div>No deployment</div>'}
                        </div>
                        `).join('')}
                        ${services.length > 6 ? `<div class="service-box">+${services.length - 6} more</div>` : ''}
                    </div>
                </div>
                ` : ''}
        
                ${volumes.length > 0 ? `
                <div class="section">
                    <div class="section-title">Volumes (${volumes.length})</div>
                    <div class="volumes-grid">
                        ${volumes.slice(0, 4).map((volume, index) => `
                        <div class="volume-box">
                            <div>${volume.environmentName}</div>
                            <div class="volume-usage">${Math.round((volume.currentSizeMB / volume.sizeMB) * 100)}%</div>
                            <div class="compact-info">
                                <div>Vol ${index + 1}</div>
                                <div>${volume.currentSizeMB.toFixed(2)}/${volume.sizeMB}MB</div>
                            </div>
                        </div>
                        `).join('')}
                        ${volumes.length > 4 ? `<div class="volume-box">+${volumes.length - 4} more</div>` : ''}
                    </div>
                </div>
                ` : `
                <div class="section">
                    <div class="section-title">Volumes</div>
                    <div class="compact-info">No volumes configured</div>
                </div>
                `}
            </div>
            
            <div class="right-panel">
        
                ${eventLogs.length > 0 ? `
                <div class="section logs-section">
                    <div class="section-title">Events (${this.data.data.lookbackHours || 24}h) - ${eventLogs.length}</div>
                    <div class="logs-container">
                        ${eventLogs.slice(0, 12).map(log => `
                        <div class="log-entry ${log.severity}">
                            <div class="log-time">${this.formatEventTimestamp(log.timestamp)}</div>
                            <div class="log-msg">${this.escapeHtml(this.extractEventAction(log.message))}</div>
                        </div>
                        `).join('')}
                    </div>
                </div>
                ` : this.data.data.eventLogsEnvironmentId ? `
                <div class="section">
                    <div class="section-title">Events (${this.data.data.lookbackHours || 24}h)</div>
                    <div class="compact-info">No recent events</div>
                </div>
                ` : `
                <div class="section">
                    <div class="section-title">Events</div>
                    <div class="compact-info">No environment ID configured</div>
                </div>
                `}
            </div>
        </div>
        
        <div class="timestamp">
            Updated: ${this.formatTimestamp(this.data.timestamp)}
        </div>
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

    const { services, volumes, eventLogs } = this.extractProjectData();
    return this.generateSuccessHTML(services, volumes, eventLogs);
  }
}

module.exports = { DashboardGenerator }; 