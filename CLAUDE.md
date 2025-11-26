# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Calendar MCP (Model Context Protocol) server that enables AI assistants to interact with Google Calendar through a secure OAuth2-authenticated interface. The server exposes calendar operations as MCP tools that can be called via Docker MCP Toolkit or other MCP clients.

## Project Structure

```
mcp-server-google-calendar/
├── src/
│   ├── index.ts           # Main MCP server implementation
│   └── auth.ts            # OAuth2 authentication setup script
├── dist/                   # Compiled JavaScript output (generated)
├── credentials.json        # Google Cloud OAuth2 client config (not in git)
├── token.json              # Generated OAuth2 token (not in git)
├── credentials.json.example # Template for credentials
├── Dockerfile             # Docker container configuration
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── .gitignore             # Protects credentials from being committed
├── README.md              # User documentation
└── CLAUDE.md              # This file
```

## Development Commands

### Build and Run
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript
npm run dev          # Run with auto-reload during development
npm run typecheck    # Check types without building
npm start            # Run the compiled server
```

### Authentication Setup
```bash
npm run auth         # Run OAuth2 authentication flow
```

### Docker Commands
```bash
# Build the Docker image
docker build -t google-calendar-mcp-server .

# Verify server is registered
docker mcp server list

# Test a tool
docker mcp tools call list_calendars '{}'
```

## Architecture

### MCP Server Pattern
The server follows the standard MCP server pattern:
1. Initialize with server name and version
2. Register tool handlers
3. Listen for requests via stdio transport
4. Execute tools and return results as formatted strings

### OAuth2 Authentication Flow
1. User obtains OAuth2 credentials from Google Cloud Console
2. User runs `npm run auth` to generate token
3. Server loads credentials and token at startup
4. Server uses token for all Calendar API requests
5. Token is automatically refreshed when expired

### Tool Implementation Pattern
Each tool follows this pattern:
```typescript
async function toolName(param1: string, param2: string): Promise<string> {
  logger.info(`Tool called with ${param1}`);

  try {
    // Validate inputs
    validateRequired(param1, "param1");

    // Get authenticated client
    const calendar = await getCalendar();

    // Make API call
    const response = await calendar.events.list({ ... });

    // Format and return result
    return `✅ Success: ${formatData(response.data)}`;
  } catch (error) {
    logger.error("Error:", error);
    return formatError(error);
  }
}
```

## Key Components

### src/index.ts:1-50
Server initialization, imports, and configuration. Sets up logging to stderr (required by MCP protocol).

### src/index.ts:52-95
Utility functions for error handling, validation, and date parsing. These are used throughout the tool implementations.

### src/index.ts:97-152
OAuth2 authentication initialization. Loads credentials and token files, creates OAuth2 client. This is called once at startup and reused for all API calls.

### src/index.ts:154-450
Tool implementations for all seven calendar operations:
- `listEvents`: List upcoming events with optional filters
- `createEvent`: Create new events
- `updateEvent`: Modify existing events
- `deleteEvent`: Remove events
- `searchEvents`: Search by keyword
- `listCalendars`: List all calendars
- `getEvent`: Get detailed event information

### src/index.ts:452-550
MCP server setup: tool definitions, request handlers, and main startup function.

### src/auth.ts
Standalone script for OAuth2 authentication. Opens browser, handles OAuth flow, saves token.

## Important Patterns

### Error Handling
- All tools use try/catch blocks
- Errors are logged to stderr and returned as formatted strings
- User-friendly error messages with ❌ emoji prefix

### Input Validation
- Required parameters validated with `validateRequired()`
- Optional parameters have sensible defaults
- String parameters properly trimmed and sanitized
- Date strings validated and converted to ISO 8601

### Output Formatting
- All tools return formatted strings (not objects)
- Use emojis for visual clarity (✅ success, ❌ error, 📅 calendar, etc.)
- Multi-line output with clear structure
- Include relevant IDs and links for follow-up actions

### TypeScript Types
- Strict mode enabled
- All function parameters explicitly typed
- No `any` types except for Google API responses
- Return types explicitly declared as `Promise<string>`

## Google Calendar API Integration

### Calendar API Client
```typescript
const calendar = google.calendar({ version: "v3", auth: authClient });
```

### Common API Patterns
```typescript
// List events
await calendar.events.list({ calendarId, maxResults, timeMin });

// Create event
await calendar.events.insert({ calendarId, requestBody: eventData });

// Update event
await calendar.events.update({ calendarId, eventId, requestBody: eventData });

// Delete event
await calendar.events.delete({ calendarId, eventId });

// Search events
await calendar.events.list({ calendarId, q: query });

// List calendars
await calendar.calendarList.list();

// Get event
await calendar.events.get({ calendarId, eventId });
```

## Configuration

### Environment Variables
- `GOOGLE_CALENDAR_CREDENTIALS_PATH`: Path to credentials.json (default: /app/credentials.json)
- `GOOGLE_CALENDAR_TOKEN_PATH`: Path to token.json (default: /app/token.json)

### Docker Volume Mounting
Credentials are mounted as read-only files directly from the project directory. The Docker MCP catalog configuration handles this automatically:
```yaml
volumes:
  - "/path/to/project/credentials.json:/app/credentials.json:ro"
  - "/path/to/project/token.json:/app/token.json:ro"
```

## Testing

### Local Testing (without Docker)
```bash
# Set local paths
export GOOGLE_CALENDAR_CREDENTIALS_PATH="./credentials.json"
export GOOGLE_CALENDAR_TOKEN_PATH="./token.json"

# Run authentication
npm run auth

# Build and run
npm run build
npm start
```

### Testing with Docker MCP Toolkit
1. Build Docker image: `docker build -t google-calendar-mcp-server .`
2. Add to catalog: Edit `~/.docker/mcp/catalogs/custom.yaml`
3. Add to registry: Edit `~/.docker/mcp/registry.yaml`
4. Verify registration: `docker mcp server list`
5. List tools: `docker mcp tools ls`
6. Test tools: `docker mcp tools call list_events '{"maxResults": "5"}'`

## Common Tasks

### Adding a New Tool
1. Implement tool function in src/index.ts (follow existing patterns)
2. Add tool definition to TOOLS array
3. Add case to tool execution handler
4. Update README.md with tool description
5. Rebuild: `npm run build && docker build -t google-calendar-mcp-server .`

### Modifying Authentication
1. Update src/auth.ts for new scopes or flow
2. Delete token.json
3. Re-run: `npm run auth`
4. Rebuild Docker image

### Debugging
1. Check logs in stderr (use `console.error()`)
2. Test tool functions directly in development mode
3. Use `npm run typecheck` to catch type errors
4. Check Docker container logs: `docker logs <container_id>`

## Security Best Practices

### Credentials Management
- Never commit credentials.json or token.json to git
- Store credentials in Docker volumes (not in image)
- Use read-only mounts for credential files
- Credentials loaded only at startup (not in git)

### Input Validation
- All user inputs validated before use
- Required fields checked with validateRequired()
- Dates parsed and validated
- Calendar IDs sanitized

### API Security
- OAuth2 token refresh handled automatically
- No credentials logged or exposed
- API timeouts to prevent hanging
- Error messages don't expose internal details

## Troubleshooting

### Authentication Issues
- Problem: "Credentials or token file not found"
  - Solution: Run `npm run auth` to generate token

- Problem: "Token expired"
  - Solution: Server auto-refreshes, but you can regenerate with `npm run auth`

### Build Issues
- Problem: TypeScript compilation errors
  - Solution: Run `npm run typecheck` to see details, fix type errors

### Runtime Issues
- Problem: "Unknown tool"
  - Solution: Check tool name in TOOLS array matches case statement

- Problem: API errors
  - Solution: Check Calendar API is enabled in Google Cloud Console

## Contributing Guidelines

When modifying this codebase:

1. **Maintain TypeScript strict mode** - No relaxing of type checking
2. **Follow existing patterns** - Use the tool implementation pattern
3. **Return strings, not objects** - All tools return formatted strings
4. **Log to stderr** - Never use console.log, always console.error
5. **Handle all errors** - Every tool needs try/catch
6. **Validate inputs** - Check all required parameters
7. **Format output** - Use emojis and clear structure
8. **Update documentation** - Keep README.md and CLAUDE.md in sync
9. **Test locally** - Run `npm run dev` and test before building Docker
10. **Type everything** - All parameters and returns explicitly typed
