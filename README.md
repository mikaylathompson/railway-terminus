# Railway Terminus

A Railway-hosted dashboard for monitoring Railway services, volumes, and event logs. This application provides a real-time view of your Railway infrastructure through a web interface and API endpoints.

## Features

- **Real-time Dashboard**: Visual overview of services, deployments, and volumes
- **Event Logs**: Recent activity logs with configurable filter and data extraction
- **API Access**: JSON endpoints for programmatic access
- **Authentication**: Bearer token authentication for security
- **Parameterization**: Customizable via HTTP headers
- **Debug Tools**: Built-in query testing and debugging

## Quick Start

### Prerequisites

- Node.js 18+
- Railway account with API token
- Docker (for containerized deployment)

### Environment Variables

Set these environment variables in your Railway project:

```bash
# Required: Authentication token for accessing the dashboard
TERMINUS_AUTH_TOKEN=your-secure-token-here

# Required: Railway API token for fetching data
RAILWAY_TOKEN=your-railway-api-token

# Optional: Default environment ID for event logs
RAILWAY_ENVIRONMENT_ID=your-environment-id

# Optional: Display timezone for all timestamps (default: UTC)
# Examples: America/New_York, Europe/London, Asia/Tokyo, etc.
DISPLAY_TIMEZONE=UTC
```

### Local Development

1. Clone and install dependencies:

```bash
cd railway-terminus
npm install
```

2. Set environment variables:

```bash
export TERMINUS_AUTH_TOKEN=your-token
export RAILWAY_TOKEN=your-railway-token
export RAILWAY_ENVIRONMENT_ID=your-env-id
export DISPLAY_TIMEZONE=America/New_York  # Optional: your preferred timezone
```

3. Start the development server:

```bash
npm run dev
```

4. Access the dashboard at `http://localhost:3000/`

### Docker Deployment

1. Build the container:

```bash
docker build -t railway-terminus .
```

2. Run with environment variables:

```bash
docker run -p 3000:3000 \
  -e TERMINUS_AUTH_TOKEN=your-token \
  -e RAILWAY_TOKEN=your-railway-token \
  -e RAILWAY_ENVIRONMENT_ID=your-env-id \
  railway-terminus
```

## API Endpoints

### Authentication

All endpoints (except `/health`) require Bearer token authentication:

```
Authorization: Bearer your-token-here
```

### Endpoints

#### `GET /` - Dashboard

Returns the main dashboard HTML.

**Headers:**

- `X-Logs-Environment-ID`: Environment ID for event logs only (preferred)
- `X-Terminus-Logs-Env-ID`: Environment ID for event logs only (legacy)
- `X-Project-ID`: Filter all data by specific project ID
- `X-Service-ID`: Filter all data by specific service ID
- `X-Environment-ID`: Filter all data by specific environment ID

**Filtering:**
When filtering headers are provided, the dashboard will show only data for the specified resources:

- **Project Filter (`X-Project-ID`)**: Shows only deployments, volumes, and services for the specified project
- **Service Filter (`X-Service-ID`)**: Shows only deployments for the specified service (must be within the filtered project if both are specified)
- **Environment Filter (`X-Environment-ID`)**: Shows only deployments and volumes for the specified environment
- **Event Logs (`X-Terminus-Logs-Env-ID`)**: Enables event logs for the specified environment (separate from filtering)

Filters can be combined. For example, providing both `X-Project-ID` and `X-Service-ID` will show only deployments for that specific service within that project.

**Note:** All timestamps are displayed in the timezone specified by the `DISPLAY_TIMEZONE` environment variable (defaults to UTC).

#### `GET /debug` - Debug Queries

Runs diagnostic queries and returns results as JSON.

#### `GET /api/data` - JSON Data

Returns raw dashboard data as JSON.

**Headers:** Same as dashboard endpoint

#### `GET /health` - Health Check

Returns service health status (no authentication required).

## Usage Examples

### Basic Dashboard Access

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/
```

### Custom Environment

```bash
curl -H "Authorization: Bearer your-token" \
     -H "X-Environment-ID: env_abc123" \
     http://localhost:3000/
```

### JSON Data Access

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/api/data
```

### Debug Queries

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/debug
```

### Debug Mode

Use the `/debug` endpoint to test individual Railway API queries and identify issues.
