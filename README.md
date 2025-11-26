# Google Calendar MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with secure access to Google Calendar.

Built with TypeScript for type safety and modern development practices.

## Purpose

This MCP server provides a secure interface for AI assistants to manage Google Calendar events, including creating, reading, updating, and deleting events.

## Features

### Current Implementation

- **`list_events`** - List upcoming calendar events with optional time range filtering
- **`create_event`** - Create new calendar events with title, time, location, and attendees
- **`update_event`** - Update existing event details
- **`delete_event`** - Delete calendar events
- **`search_events`** - Search for events by keyword
- **`list_calendars`** - List all available calendars
- **`get_event`** - Get detailed information about a specific event

## Prerequisites

- Node.js 20 or higher
- Docker Desktop with MCP Toolkit enabled
- Docker MCP CLI plugin (`docker mcp` command)
- Google Cloud Console project with Calendar API enabled
- OAuth 2.0 credentials (credentials.json)
- OAuth token (generated through authentication flow)

## Google Calendar API Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Desktop app" as application type
4. Download the credentials JSON file
5. Save it as `credentials.json` in the project root

### Step 3: Generate Token

```bash
# Install dependencies
npm install

# Run authentication script
npm run auth
```

This will:
1. Open a browser window
2. Ask you to sign in to your Google account
3. Request calendar permissions
4. Save the token to `token.json`

## Installation

### Step 1: Build the Project

```bash
npm install
npm run build
```

### Step 2: Build Docker Image

```bash
docker build -t google-calendar-mcp-server .
```

### Step 3: Set Up Docker MCP

The credentials and token files will be mounted directly from your project directory into the container.

### Step 4: Create Custom Catalog

Create or edit `~/.docker/mcp/catalogs/custom.yaml`:

```yaml
version: 3
name: custom
displayName: Custom MCP Servers
registry:
  google-calendar:
    description: "Google Calendar MCP Server with OAuth2 authentication for managing calendar events and tasks"
    title: "Google Calendar"
    type: server
    dateAdded: "2025-11-26T00:00:00Z"
    image: google-calendar-mcp-server:latest
    ref: ""
    readme: ""
    toolsUrl: ""
    source: ""
    upstream: ""
    icon: ""
    tools:
      - name: list_events
      - name: create_event
      - name: update_event
      - name: delete_event
      - name: search_events
      - name: list_calendars
      - name: get_event
    prompts: 0
    resources: {}
    volumes:
      - "/Users/YOUR_USERNAME/path/to/mcp-server-google-calendar/credentials.json:/app/credentials.json:ro"
      - "/Users/YOUR_USERNAME/path/to/mcp-server-google-calendar/token.json:/app/token.json:ro"
    env:
      - name: GOOGLE_CALENDAR_CREDENTIALS_PATH
        value: "/app/credentials.json"
      - name: GOOGLE_CALENDAR_TOKEN_PATH
        value: "/app/token.json"
    metadata:
      category: productivity
      tags:
        - calendar
        - google
        - oauth2
        - scheduling
        - events
      license: MIT
      owner: local
```

### Step 5: Update Registry

Edit `~/.docker/mcp/registry.yaml`:

```yaml
registry:
  google-calendar:
    ref: ""
```

### Step 6: Test the Server

Verify the server is available:

```bash
docker mcp server list
```

You should see `google-calendar` in the list.

### Step 7: Use the Tools

You can now use the Google Calendar tools through any MCP client or directly via Docker MCP CLI:

```bash
# List all available tools
docker mcp tools ls

# Example: List events
docker mcp tools call list_events '{"maxResults": "5"}'

# Example: Create an event
docker mcp tools call create_event '{
  "summary": "Team Meeting",
  "start": "2025-11-27T14:00:00",
  "end": "2025-11-27T15:00:00"
}'

# Example: Search events
docker mcp tools call search_events '{"query": "meeting"}'
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Run production build
npm start
```

### Local Testing

```bash
# Set environment variables for testing
export GOOGLE_CALENDAR_CREDENTIALS_PATH="./credentials.json"
export GOOGLE_CALENDAR_TOKEN_PATH="./token.json"

# Run directly
npm start
```

## Usage Examples

Using Docker MCP CLI:

```bash
# List today's events
docker mcp tools call list_events '{"maxResults": "10"}'

# Create a new event
docker mcp tools call create_event '{
  "summary": "Team Sync",
  "start": "2025-11-27T14:00:00",
  "end": "2025-11-27T15:00:00",
  "description": "Weekly team sync meeting"
}'

# List all calendars
docker mcp tools call list_calendars '{}'

# Search for events
docker mcp tools call search_events '{"query": "project review"}'

# Get event details
docker mcp tools call get_event '{"eventId": "xyz123"}'

# Delete an event
docker mcp tools call delete_event '{"eventId": "xyz123"}'

# Update an event
docker mcp tools call update_event '{
  "eventId": "xyz123",
  "start": "2025-11-27T15:00:00"
}'
```

## Architecture

```
MCP Client/CLI → Docker MCP Toolkit → Google Calendar MCP Server → Google Calendar API
                                              ↓
                                   Volume-mounted credentials
                                (credentials.json + token.json)
```

## TypeScript Benefits

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Enhanced autocomplete and refactoring
- **Modern JavaScript**: Use latest ECMAScript features
- **Maintainability**: Self-documenting code with types

## Security Considerations

- All credentials stored in volume-mounted files
- Never hardcode credentials
- Running as non-root user
- Sensitive data never logged
- Input validation on all parameters
- Timeout protection on API calls
- OAuth 2.0 token refresh handled automatically

## Troubleshooting

### Tools Not Appearing

- Verify Docker image built successfully: `docker images | grep google-calendar`
- Check catalog file syntax: `cat ~/.docker/mcp/catalogs/custom.yaml`
- Verify registry entry: `cat ~/.docker/mcp/registry.yaml`
- Check server list: `docker mcp server list`

### Build Errors

- Check TypeScript version compatibility
- Run `npm run typecheck` to see type errors
- Ensure all dependencies are installed

### Authentication Errors

- Verify credentials.json is valid OAuth 2.0 client configuration
- Ensure token.json exists and is not expired
- Re-run `npm run auth` to regenerate token
- Check file paths match environment variables

### API Errors

- Verify Google Calendar API is enabled in Cloud Console
- Check OAuth scopes include calendar access
- Ensure token has not been revoked

## Token Refresh

The server automatically refreshes OAuth tokens when they expire. If you encounter persistent authentication errors:

1. Delete `token.json`
2. Run `npm run auth` again
3. The new token will be automatically picked up by the server (no rebuild needed since it's volume-mounted)

## License

MIT License
