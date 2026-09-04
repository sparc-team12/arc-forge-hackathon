import { z } from "zod";

export default function apiBasedTools(server) {
  const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api";

  // Helper function to make HTTP requests
  async function makeRequest(method, url, data = null, options = {}) {
    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    // Merge other options except headers (which we already handled)
    const { headers: _, ...otherOptions } = options;
    Object.assign(config, otherOptions);

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const result = await response.text();

      let jsonResult;
      try {
        jsonResult = JSON.parse(result);
      } catch {
        jsonResult = result;
      }

      return {
        status: response.status,
        data: jsonResult,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
      };
    }
  }

  // Issues Tools

  server.registerTool(
    "issues-list",
    {
      title: "List Issues",
      description: "Get a list of issues with optional filtering",
      inputSchema: {
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Filter by status"),
        assigned_user_id: z
          .string()
          .optional()
          .describe("Filter by assigned user ID"),
        tag_ids: z.string().optional().describe("Comma-separated tag IDs"),
        search: z
          .string()
          .optional()
          .describe("Search in title and description"),
        page: z.number().optional().describe("Page number (default: 1)"),
        limit: z
          .number()
          .optional()
          .describe("Items per page (default: 10, max: 100)"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("Filter by priority"),
        created_by_user_id: z
          .string()
          .optional()
          .describe("Filter by creator user ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...queryParams } = params;
      const searchParams = new URLSearchParams();

      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });

      const url = `${API_BASE_URL}/issues${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

      const result = await makeRequest("GET", url, null, {
        headers: { "x-api-key": apiKey },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-create",
    {
      title: "Create Issue",
      description: "Create a new issue",
      inputSchema: {
        title: z.string().describe("Issue title"),
        description: z.string().optional().describe("Issue description"),
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Issue status"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional()
          .describe("Issue priority"),
        assigned_user_id: z.string().optional().describe("Assigned user ID"),
        tag_ids: z.array(z.number()).optional().describe("Array of tag IDs"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...issueData } = params;

      const result = await makeRequest(
        "POST",
        `${API_BASE_URL}/issues`,
        issueData,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-get",
    {
      title: "Get Issue by ID",
      description: "Get a specific issue by its ID",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await makeRequest(
        "GET",
        `${API_BASE_URL}/issues/${id}`,
        null,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-update",
    {
      title: "Update Issue",
      description: "Update an existing issue",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        title: z.string().optional().describe("Issue title"),
        description: z.string().optional().describe("Issue description"),
        status: z
          .enum(["not_started", "in_progress", "done"])
          .optional()
          .describe("Issue status"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("Issue priority"),
        assigned_user_id: z.string().optional().describe("Assigned user ID"),
        tag_ids: z.array(z.number()).optional().describe("Array of tag IDs"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { id, apiKey, ...updateData } = params;

      const result = await makeRequest(
        "PUT",
        `${API_BASE_URL}/issues/${id}`,
        updateData,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "issues-delete",
    {
      title: "Delete Issue",
      description: "Delete an issue by ID",
      inputSchema: {
        id: z.number().describe("Issue ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await makeRequest(
        "DELETE",
        `${API_BASE_URL}/issues/${id}`,
        null,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tags Tools

  server.registerTool(
    "tags-list",
    {
      title: "List Tags",
      description: "Get all available tags",
      inputSchema: {
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ apiKey }) => {
      const result = await makeRequest("GET", `${API_BASE_URL}/tags`, null, {
        headers: { "x-api-key": apiKey },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "tags-create",
    {
      title: "Create Tag",
      description: "Create a new tag",
      inputSchema: {
        name: z.string().describe("Tag name"),
        color: z.string().describe("Tag color (hex format)"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async (params) => {
      const { apiKey, ...tagData } = params;

      const result = await makeRequest(
        "POST",
        `${API_BASE_URL}/tags`,
        tagData,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "tags-delete",
    {
      title: "Delete Tag",
      description: "Delete a tag by ID",
      inputSchema: {
        id: z.number().describe("Tag ID"),
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ id, apiKey }) => {
      const result = await makeRequest(
        "DELETE",
        `${API_BASE_URL}/tags/${id}`,
        null,
        { headers: { "x-api-key": apiKey } }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Users Tools

  server.registerTool(
    "users-list",
    {
      title: "List Users",
      description: "Get all users",
      inputSchema: {
        apiKey: z.string().describe("API key for authentication"),
      },
    },
    async ({ apiKey }) => {
      const result = await makeRequest("GET", `${API_BASE_URL}/users`, null, {
        headers: { "x-api-key": apiKey },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // API Key Tools

  server.registerTool(
    "api-key-verify",
    {
      title: "Verify API Key",
      description: "Verify if an API key is valid",
      inputSchema: {
        apiKey: z.string().describe("API key to verify"),
      },
    },
    async ({ apiKey }) => {
      const result = await makeRequest(
        "POST",
        `${API_BASE_URL}/auth/api-key/verify`,
        { key: apiKey }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Health Check Tools

  server.registerTool(
    "health-status",
    {
      title: "Health Status",
      description: "Get the health status of the API",
    },
    async () => {
      const result = await makeRequest(
        "GET",
        `${API_BASE_URL.replace("/api", "")}/health`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "health-ready",
    {
      title: "Readiness Probe",
      description: "Check if the API is ready to serve requests",
    },
    async () => {
      const result = await makeRequest(
        "GET",
        `${API_BASE_URL.replace("/api", "")}/health/ready`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "health-live",
    {
      title: "Liveness Probe",
      description: "Check if the API is alive",
    },
    async () => {
      const result = await makeRequest(
        "GET",
        `${API_BASE_URL.replace("/api", "")}/health/live`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
