#!/usr/bin/env node

/**
 * Google Calendar MCP Server
 * Provides access to Google Calendar API for AI assistants
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";

// Configuration
const CREDENTIALS_PATH = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH || "/app/credentials/credentials.json";
const TOKEN_PATH = process.env.GOOGLE_CALENDAR_TOKEN_PATH || "/app/credentials/token.json";

// Logging configuration - log to stderr
const logger = {
  info: (...args: unknown[]) => console.error("[INFO]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  warn: (...args: unknown[]) => console.error("[WARN]", ...args),
};

// === UTILITY FUNCTIONS ===

/**
 * Format error message for user display
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `❌ Error: ${error.message}`;
  }
  return `❌ Error: ${String(error)}`;
}

/**
 * Validate required parameter
 */
function validateRequired(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}


// === GOOGLE CALENDAR AUTH ===

let auth: OAuth2Client | null = null;

/**
 * Initialize Google Calendar API authentication
 */
async function initializeAuth(): Promise<OAuth2Client> {
  if (auth) return auth;

  try {
    // Load credentials
    const credentialsContent = await fs.readFile(CREDENTIALS_PATH, "utf-8");
    const credentials = JSON.parse(credentialsContent);

    // Load token
    const tokenContent = await fs.readFile(TOKEN_PATH, "utf-8");
    const token = JSON.parse(tokenContent);

    // Create OAuth2 client
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    auth.setCredentials(token);

    logger.info("Google Calendar authentication initialized");
    return auth;
  } catch (error) {
    logger.error("Failed to initialize auth:", error);
    throw new Error("Failed to initialize Google Calendar authentication. Make sure credentials and token files are properly set up.");
  }
}

/**
 * Get authenticated Calendar API client
 */
async function getCalendar() {
  const authClient = await initializeAuth();
  return google.calendar({ version: "v3", auth: authClient });
}

// === TOOL IMPLEMENTATIONS ===

/**
 * List upcoming calendar events
 */
async function listEvents(
  maxResults: string = "10",
  calendarId: string = "primary",
  timeMin: string = "",
  timeMax: string = ""
): Promise<string> {
  logger.info(`Listing events: max=${maxResults}, calendar=${calendarId}`);

  try {
    const calendar = await getCalendar();
    const maxResultsNum = parseInt(maxResults) || 10;

    const params: any = {
      calendarId,
      maxResults: maxResultsNum,
      singleEvents: true,
      orderBy: "startTime",
    };

    if (timeMin) {
      params.timeMin = new Date(timeMin).toISOString();
    } else {
      params.timeMin = new Date().toISOString();
    }

    if (timeMax) {
      params.timeMax = new Date(timeMax).toISOString();
    }

    const response = await calendar.events.list(params);
    const events = response.data.items || [];

    if (events.length === 0) {
      return "📅 No upcoming events found.";
    }

    let result = `📅 Found ${events.length} event(s):\n\n`;

    for (const event of events) {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      result += `📍 ${event.summary || "Untitled Event"}\n`;
      result += `   ID: ${event.id}\n`;
      result += `   Start: ${start}\n`;
      result += `   End: ${end}\n`;
      if (event.description) {
        result += `   Description: ${event.description}\n`;
      }
      if (event.location) {
        result += `   Location: ${event.location}\n`;
      }
      if (event.attendees && event.attendees.length > 0) {
        result += `   Attendees: ${event.attendees.map(a => a.email).join(", ")}\n`;
      }
      result += "\n";
    }

    return result;
  } catch (error) {
    logger.error("Error listing events:", error);
    return formatError(error);
  }
}

/**
 * Create a new calendar event
 */
async function createEvent(
  summary: string = "",
  start: string = "",
  end: string = "",
  description: string = "",
  location: string = "",
  attendees: string = "",
  calendarId: string = "primary"
): Promise<string> {
  logger.info(`Creating event: ${summary}`);

  try {
    validateRequired(summary, "summary");
    validateRequired(start, "start");
    validateRequired(end, "end");

    const calendar = await getCalendar();

    const eventData: any = {
      summary,
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: "UTC",
      },
    };

    if (description) {
      eventData.description = description;
    }

    if (location) {
      eventData.location = location;
    }

    if (attendees) {
      eventData.attendees = attendees.split(",").map(email => ({ email: email.trim() }));
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: eventData,
    });

    return `✅ Event created successfully!\n\n` +
           `📍 ${response.data.summary}\n` +
           `   ID: ${response.data.id}\n` +
           `   Start: ${response.data.start?.dateTime || response.data.start?.date}\n` +
           `   End: ${response.data.end?.dateTime || response.data.end?.date}\n` +
           `   Link: ${response.data.htmlLink}`;
  } catch (error) {
    logger.error("Error creating event:", error);
    return formatError(error);
  }
}

/**
 * Update an existing calendar event
 */
async function updateEvent(
  eventId: string = "",
  summary: string = "",
  start: string = "",
  end: string = "",
  description: string = "",
  location: string = "",
  calendarId: string = "primary"
): Promise<string> {
  logger.info(`Updating event: ${eventId}`);

  try {
    validateRequired(eventId, "eventId");

    const calendar = await getCalendar();

    // Get existing event
    const existing = await calendar.events.get({
      calendarId,
      eventId,
    });

    const eventData: any = {
      summary: summary || existing.data.summary,
    };

    if (start) {
      eventData.start = {
        dateTime: new Date(start).toISOString(),
        timeZone: "UTC",
      };
    } else {
      eventData.start = existing.data.start;
    }

    if (end) {
      eventData.end = {
        dateTime: new Date(end).toISOString(),
        timeZone: "UTC",
      };
    } else {
      eventData.end = existing.data.end;
    }

    if (description !== undefined) {
      eventData.description = description;
    }

    if (location !== undefined) {
      eventData.location = location;
    }

    const response = await calendar.events.update({
      calendarId,
      eventId,
      requestBody: eventData,
    });

    return `✅ Event updated successfully!\n\n` +
           `📍 ${response.data.summary}\n` +
           `   ID: ${response.data.id}\n` +
           `   Start: ${response.data.start?.dateTime || response.data.start?.date}\n` +
           `   End: ${response.data.end?.dateTime || response.data.end?.date}`;
  } catch (error) {
    logger.error("Error updating event:", error);
    return formatError(error);
  }
}

/**
 * Delete a calendar event
 */
async function deleteEvent(
  eventId: string = "",
  calendarId: string = "primary"
): Promise<string> {
  logger.info(`Deleting event: ${eventId}`);

  try {
    validateRequired(eventId, "eventId");

    const calendar = await getCalendar();

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return `✅ Event deleted successfully!\n   Event ID: ${eventId}`;
  } catch (error) {
    logger.error("Error deleting event:", error);
    return formatError(error);
  }
}

/**
 * Search for events
 */
async function searchEvents(
  query: string = "",
  maxResults: string = "10",
  calendarId: string = "primary"
): Promise<string> {
  logger.info(`Searching events: ${query}`);

  try {
    validateRequired(query, "query");

    const calendar = await getCalendar();
    const maxResultsNum = parseInt(maxResults) || 10;

    const response = await calendar.events.list({
      calendarId,
      q: query,
      maxResults: maxResultsNum,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];

    if (events.length === 0) {
      return `🔍 No events found matching: "${query}"`;
    }

    let result = `🔍 Found ${events.length} event(s) matching "${query}":\n\n`;

    for (const event of events) {
      const start = event.start?.dateTime || event.start?.date;
      result += `📍 ${event.summary || "Untitled Event"}\n`;
      result += `   ID: ${event.id}\n`;
      result += `   Start: ${start}\n`;
      if (event.description) {
        result += `   Description: ${event.description}\n`;
      }
      result += "\n";
    }

    return result;
  } catch (error) {
    logger.error("Error searching events:", error);
    return formatError(error);
  }
}

/**
 * List all calendars
 */
async function listCalendars(): Promise<string> {
  logger.info("Listing calendars");

  try {
    const calendar = await getCalendar();

    const response = await calendar.calendarList.list();
    const calendars = response.data.items || [];

    if (calendars.length === 0) {
      return "📅 No calendars found.";
    }

    let result = `📅 Found ${calendars.length} calendar(s):\n\n`;

    for (const cal of calendars) {
      result += `📍 ${cal.summary || "Untitled Calendar"}\n`;
      result += `   ID: ${cal.id}\n`;
      if (cal.description) {
        result += `   Description: ${cal.description}\n`;
      }
      result += `   Primary: ${cal.primary ? "Yes" : "No"}\n`;
      result += `   Access: ${cal.accessRole}\n`;
      result += "\n";
    }

    return result;
  } catch (error) {
    logger.error("Error listing calendars:", error);
    return formatError(error);
  }
}

/**
 * Get event details
 */
async function getEvent(
  eventId: string = "",
  calendarId: string = "primary"
): Promise<string> {
  logger.info(`Getting event: ${eventId}`);

  try {
    validateRequired(eventId, "eventId");

    const calendar = await getCalendar();

    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    const event = response.data;
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;

    let result = `📍 ${event.summary || "Untitled Event"}\n\n`;
    result += `ID: ${event.id}\n`;
    result += `Start: ${start}\n`;
    result += `End: ${end}\n`;
    result += `Status: ${event.status}\n`;

    if (event.description) {
      result += `Description: ${event.description}\n`;
    }

    if (event.location) {
      result += `Location: ${event.location}\n`;
    }

    if (event.attendees && event.attendees.length > 0) {
      result += `\nAttendees:\n`;
      for (const attendee of event.attendees) {
        result += `  - ${attendee.email} (${attendee.responseStatus || "no response"})\n`;
      }
    }

    if (event.conferenceData?.entryPoints) {
      result += `\nConference:\n`;
      for (const entry of event.conferenceData.entryPoints) {
        result += `  - ${entry.entryPointType}: ${entry.uri}\n`;
      }
    }

    result += `\nLink: ${event.htmlLink}`;

    return result;
  } catch (error) {
    logger.error("Error getting event:", error);
    return formatError(error);
  }
}

// === MCP SERVER SETUP ===

const server = new Server(
  {
    name: "google-calendar",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: "list_events",
    description: "List upcoming calendar events",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: {
          type: "string",
          description: "Maximum number of events to return (default: 10)",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        timeMin: {
          type: "string",
          description: "Start time (ISO 8601 format, optional)",
        },
        timeMax: {
          type: "string",
          description: "End time (ISO 8601 format, optional)",
        },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new calendar event",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Event title/summary",
        },
        start: {
          type: "string",
          description: "Start time (ISO 8601 format)",
        },
        end: {
          type: "string",
          description: "End time (ISO 8601 format)",
        },
        description: {
          type: "string",
          description: "Event description (optional)",
        },
        location: {
          type: "string",
          description: "Event location (optional)",
        },
        attendees: {
          type: "string",
          description: "Comma-separated list of attendee emails (optional)",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "Event ID to update",
        },
        summary: {
          type: "string",
          description: "New event title/summary (optional)",
        },
        start: {
          type: "string",
          description: "New start time (ISO 8601 format, optional)",
        },
        end: {
          type: "string",
          description: "New end time (ISO 8601 format, optional)",
        },
        description: {
          type: "string",
          description: "New event description (optional)",
        },
        location: {
          type: "string",
          description: "New event location (optional)",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "Event ID to delete",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "search_events",
    description: "Search for events by keyword",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        maxResults: {
          type: "string",
          description: "Maximum number of results (default: 10)",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_calendars",
    description: "List all available calendars",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_event",
    description: "Get detailed information about a specific event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "Event ID",
        },
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
      },
      required: ["eventId"],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_events": {
        const maxResults = (args?.maxResults as string) || "10";
        const calendarId = (args?.calendarId as string) || "primary";
        const timeMin = (args?.timeMin as string) || "";
        const timeMax = (args?.timeMax as string) || "";
        return {
          content: [
            {
              type: "text",
              text: await listEvents(maxResults, calendarId, timeMin, timeMax),
            },
          ],
        };
      }

      case "create_event": {
        const summary = (args?.summary as string) || "";
        const start = (args?.start as string) || "";
        const end = (args?.end as string) || "";
        const description = (args?.description as string) || "";
        const location = (args?.location as string) || "";
        const attendees = (args?.attendees as string) || "";
        const calendarId = (args?.calendarId as string) || "primary";
        return {
          content: [
            {
              type: "text",
              text: await createEvent(summary, start, end, description, location, attendees, calendarId),
            },
          ],
        };
      }

      case "update_event": {
        const eventId = (args?.eventId as string) || "";
        const summary = (args?.summary as string) || "";
        const start = (args?.start as string) || "";
        const end = (args?.end as string) || "";
        const description = (args?.description as string) || "";
        const location = (args?.location as string) || "";
        const calendarId = (args?.calendarId as string) || "primary";
        return {
          content: [
            {
              type: "text",
              text: await updateEvent(eventId, summary, start, end, description, location, calendarId),
            },
          ],
        };
      }

      case "delete_event": {
        const eventId = (args?.eventId as string) || "";
        const calendarId = (args?.calendarId as string) || "primary";
        return {
          content: [
            {
              type: "text",
              text: await deleteEvent(eventId, calendarId),
            },
          ],
        };
      }

      case "search_events": {
        const query = (args?.query as string) || "";
        const maxResults = (args?.maxResults as string) || "10";
        const calendarId = (args?.calendarId as string) || "primary";
        return {
          content: [
            {
              type: "text",
              text: await searchEvents(query, maxResults, calendarId),
            },
          ],
        };
      }

      case "list_calendars": {
        return {
          content: [
            {
              type: "text",
              text: await listCalendars(),
            },
          ],
        };
      }

      case "get_event": {
        const eventId = (args?.eventId as string) || "";
        const calendarId = (args?.calendarId as string) || "primary";
        return {
          content: [
            {
              type: "text",
              text: await getEvent(eventId, calendarId),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: formatError(error),
        },
      ],
      isError: true,
    };
  }
});

// === SERVER STARTUP ===

async function main() {
  logger.info("Starting Google Calendar MCP server...");

  // Check if credentials exist
  try {
    await fs.access(CREDENTIALS_PATH);
    await fs.access(TOKEN_PATH);
  } catch (error) {
    logger.error("Credentials or token file not found!");
    logger.error(`Expected credentials at: ${CREDENTIALS_PATH}`);
    logger.error(`Expected token at: ${TOKEN_PATH}`);
    logger.error("Please run the authentication setup first.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Google Calendar MCP server running on stdio");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
