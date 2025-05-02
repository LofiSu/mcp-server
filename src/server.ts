import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import * as tools from "./tools/index.js";
import { debugLog } from "./utils/log.js";
import { Context } from "./types/context.js";
import { Tool } from "./types/tools.js";
import { mcpContext } from "./utils/mcp-context.js";

// 创建 Express 应用
const app = express();
app.use(express.json());

// 存储会话传输实例
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function validateAcceptHeader(req: express.Request): boolean {
  const acceptHeader = req.headers.accept || "";
  return (
    acceptHeader.includes("application/json") &&
    acceptHeader.includes("text/event-stream")
  );
}

function registerTool(server: McpServer, tool: Tool, context: Context) {
  server.tool(
    tool.schema.name,
    tool.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: ${tool.schema.name}`, params);
      return await tool.handle(context, params);
    }
  );
}

function createServer() {
  const server = new McpServer({
    name: "In Browser MCP",
    version: "1.0.0",
  });

  // context 通过插件API通信
  const context = {
    async sendSocketMessage(type: string, payload: any) {
      // 通过插件API（WebSocket/HTTP）发送消息
      return mcpContext.sendSocketMessage(type, payload);
    },
    async wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async getBrowserState() {
      // 通过插件API获取当前页面状态
      const url = await mcpContext.sendSocketMessage("getUrl", undefined);
      const title = await mcpContext.sendSocketMessage("getTitle", undefined);
      return { url, title };
    },
    async executeBrowserAction(action: string, params: any) {
      return this.sendSocketMessage(`browser_${action}`, params);
    },
  } as Context;

  const allTools = [
    tools.navigate,
    tools.goBack,
    tools.goForward,
    tools.wait,
    tools.pressKey,
    tools.click,
    tools.drag,
    tools.hover,
    tools.type,
    tools.selectOption,
    tools.snapshot,
    tools.getConsoleLogs,
    tools.screenshot
  ];

  allTools.forEach(tool => registerTool(server, tool, context));
  return server;
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const method = req.body?.method;
  const isInitialize = method === "initialize";
  debugLog(`📩 收到方法: ${method}，Session: ${sessionId || "无"}`);
  if (!validateAcceptHeader(req)) {
    debugLog(`❌ 无效的 Accept 头部: ${req.headers.accept}`);
    return res.status(406).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Not Acceptable: Client must accept both application/json and text/event-stream",
      },
      id: null,
    });
  }
  let transport: StreamableHTTPServerTransport;
  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
    debugLog(`✅ 使用现有会话: ${sessionId}`);
    res.setHeader("Mcp-Session-Id", sessionId);
  } else if (!sessionId && isInitialize) {
    const newSessionId = randomUUID();
    debugLog(`🆕 创建新会话: ${newSessionId}`);
    res.setHeader("Mcp-Session-Id", newSessionId);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        debugLog(`✅ 会话初始化成功: ${id}`);
      }
    });
    transports[newSessionId] = transport;
    transport.onclose = () => {
      if (transport.sessionId) {
        debugLog(`❌ 会话关闭: ${transport.sessionId}`);
        delete transports[transport.sessionId];
      }
    };
    const server = createServer();
    await server.connect(transport);
    debugLog(`🔌 服务器已连接到传输层`);
  } else {
    debugLog(`❌ 无效请求: sessionId=${sessionId || "无"}, isInitialize=${isInitialize}`);
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: Server not initialized",
      },
      id: null,
    });
  }
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    debugLog("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId || !transports[sessionId]) {
    debugLog(`❌ 无效会话请求: sessionId=${sessionId || "无"}`);
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Invalid or missing session ID",
      },
      id: null,
    });
  }
  if (req.method === "GET" && !req.headers.accept?.includes("text/event-stream")) {
    debugLog(`❌ GET 请求缺少有效的 Accept 头部: ${req.headers.accept}`);
    return res.status(406).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Not Acceptable: Client must accept text/event-stream",
      },
      id: null,
    });
  }
  debugLog(`✅ 会话请求验证通过: ${sessionId}`);
  res.setHeader("Mcp-Session-Id", sessionId);
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    debugLog("Error handling session request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

app.get("/mcp", handleSessionRequest);
app.delete("/mcp", handleSessionRequest);

// 启动HTTP服务器（不再自动启动浏览器和WebSocket，由插件负责）
const PORT = 3000;
app.listen(PORT, () => {
  debugLog(`🚀 MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
  debugLog(`💻 等待插件连接，AI可通过MCP协议调用工具，插件负责实际页面操作`);
});
