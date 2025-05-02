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

/**
 * 验证请求头中的 Accept 头部是否符合 MCP 协议要求
 * MCP 协议要求 POST 请求必须同时接受 application/json 和 text/event-stream
 */
function validateAcceptHeader(req: express.Request): boolean {
  const acceptHeader = req.headers.accept || "";
  // 检查是否同时包含 application/json 和 text/event-stream
  return (
    acceptHeader.includes("application/json") &&
    acceptHeader.includes("text/event-stream")
  );
}

/**
 * 工具注册
 */
function registerTool(server: McpServer, tool: Tool, context: Context) {
  server.tool(
    tool.schema.name,
    tool.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: ${tool.schema.name}`, params);
      // 工具处理逻辑现在依赖于 mcpContext 通过插件API与浏览器通信
      return await tool.handle(context, params);
    }
  );
}

/**
 * 创建 MCP Server 实例
 * 注册所有工具并返回服务器实例
 */
function createServer() {
  const server = new McpServer({
    name: "Browser Plugin MCP Server", // 更新服务器名称
    version: "1.0.0",
  });

  // 创建 context 对象
  // context 现在依赖 mcpContext 通过某种机制（待实现）与浏览器插件通信
  const context = {
    async sendSocketMessage(type: string, payload: any) {
      // 依赖 mcpContext 实现与插件的通信
      return mcpContext.sendSocketMessage(type, payload);
    },
    async wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async getBrowserState() {
      // 依赖 mcpContext 实现从插件获取状态
      return mcpContext.getBrowserState();
    },
    async executeBrowserAction(action: string, params: any) {
      // 依赖 mcpContext 实现通过插件执行动作
      return this.sendSocketMessage(`browser_${action}`, params);
    },
    isConnected(): boolean {
      // 依赖 mcpContext 获取插件连接状态
      return mcpContext.isConnected();
    },
  } as Context;

  const allTools = [
    // 导航类
    tools.navigate,
    tools.goBack,
    tools.goForward,
    tools.wait,
    tools.pressKey,
    
    // 交互类
    tools.click,
    tools.drag,
    tools.hover,
    tools.type,
    tools.selectOption,
    
    // 快照类
    tools.snapshot,
    
    // 实用工具类
    tools.getConsoleLogs,
    tools.screenshot
  ];

  // 批量注册所有工具
  allTools.forEach(tool => registerTool(server, tool, context));

  return server;
}

// POST /mcp - 处理 JSON-RPC 请求
app.post("/mcp", async (req, res) => {
  // 获取会话ID (不区分大小写)
  const sessionId = req.headers["mcp-session-id"] as string;
  const method = req.body?.method;
  const isInitialize = method === "initialize";
  
  debugLog(`📩 收到方法: ${method}，Session: ${sessionId || "无"}`); 

  // 验证 Accept 头部
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

  // 处理现有会话
  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
    debugLog(`✅ 使用现有会话: ${sessionId}`);
    res.setHeader("Mcp-Session-Id", sessionId);
  } 
  // 处理新的初始化请求
  else if (!sessionId && isInitialize) {
    const newSessionId = randomUUID();
    debugLog(`🆕 创建新会话: ${newSessionId}`);
    
    // 设置会话ID响应头
    res.setHeader("Mcp-Session-Id", newSessionId);
    
    // 创建传输实例
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        debugLog(`✅ 会话初始化成功: ${id}`);
      }
    });

    // 存储传输实例
    transports[newSessionId] = transport;
    
    // 设置会话关闭处理
    transport.onclose = () => {
      if (transport.sessionId) {
        debugLog(`❌ 会话关闭: ${transport.sessionId}`);
        // 在这里可以添加清理插件连接的逻辑（如果需要）
        delete transports[transport.sessionId];
      }
    };

    // 创建并连接服务器
    const server = createServer();
    await server.connect(transport);
    debugLog(`🔌 服务器已连接到传输层`);
  } 
  // 处理无效请求
  else {
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
    // 处理请求
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

// 处理 GET 和 DELETE 请求的通用函数
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  
  // 验证会话ID
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
  
  // 验证 Accept 头部 (仅对 GET 请求)
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

// GET /mcp - 客户端从服务端获取事件流
app.get("/mcp", handleSessionRequest);

// DELETE /mcp - 主动关闭会话
app.delete("/mcp", handleSessionRequest);

// 启动HTTP服务器（不再自动启动浏览器和WebSocket，由插件负责连接）
const PORT = 3000;
app.listen(PORT, () => {
  debugLog(`🚀 MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
  debugLog(`🔌 等待浏览器插件连接... AI可通过MCP协议调用工具，由插件负责实际页面操作`);
});

// 移除进程退出时关闭浏览器的逻辑
process.on('SIGINT', async () => {
  debugLog('👋 正在关闭服务器...');
  // 不再需要关闭 browserAutomation 和 browserConnector
  process.exit(0);
});
