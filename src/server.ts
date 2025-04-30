import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import * as common from "./tools/common.js";
import * as snapshot from "./tools/snapshot.js";
import * as custom from "./tools/custom.js";
import { debugLog } from "./utils/log.js";

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
 * 创建 MCP Server 实例
 * 注册所有工具并返回服务器实例
 */
function createServer() {
  const server = new McpServer({
    name: "Browser MCP",
    version: "1.0.0",
  });

  // 创建 context 对象
  const context = {
    socket: null as any,
    async sendSocketMessage(type: string, payload: any) {
      debugLog(`📤 发送 socket 消息: ${type}`, payload);
      return Promise.resolve();
    },
    async wait(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
    async getBrowserState() {
      return {};
    },
    async executeBrowserAction(action: string, params: any) {
      return this.sendSocketMessage(`browser_${action}`, params);
    },
  } as any;

  // 工具注册 - 按照 MCP 协议标准方式注册工具
  // 导航工具
  server.tool(
    common.navigate(true).schema.name,
    common.navigate(true).schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: navigate`, params);
      return await common.navigate(true).handle(context, params);
    }
  );

  // 后退工具
  server.tool(
    common.goBack(true).schema.name,
    common.goBack(true).schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: goBack`, params);
      return await common.goBack(true).handle(context, params);
    }
  );

  // 前进工具
  server.tool(
    common.goForward(true).schema.name,
    common.goForward(true).schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: goForward`, params);
      return await common.goForward(true).handle(context, params);
    }
  );

  // 快照工具
  server.tool(
    snapshot.snapshot.schema.name,
    snapshot.snapshot.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: snapshot`, params);
      return await snapshot.snapshot.handle(context, params);
    }
  );

  // 点击工具
  server.tool(
    snapshot.click.schema.name,
    snapshot.click.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: click`, params);
      return await snapshot.click.handle(context, params);
    }
  );

  // 悬停工具
  server.tool(
    snapshot.hover.schema.name,
    snapshot.hover.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: hover`, params);
      return await snapshot.hover.handle(context, params);
    }
  );

  // 输入工具
  server.tool(
    snapshot.type.schema.name,
    snapshot.type.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: type`, params);
      return await snapshot.type.handle(context, params);
    }
  );

  // 选择选项工具
  server.tool(
    snapshot.selectOption.schema.name,
    snapshot.selectOption.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: selectOption`, params);
      return await snapshot.selectOption.handle(context, params);
    }
  );

  // 按键工具
  server.tool(
    common.pressKey.schema.name,
    common.pressKey.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: pressKey`, params);
      return await common.pressKey.handle(context, params);
    }
  );

  // 等待工具
  server.tool(
    common.wait.schema.name,
    common.wait.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: wait`, params);
      return await common.wait.handle(context, params);
    }
  );

  // 获取控制台日志工具
  server.tool(
    custom.getConsoleLogs.schema.name,
    custom.getConsoleLogs.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: getConsoleLogs`, params);
      return await custom.getConsoleLogs.handle(context, params);
    }
  );

  // 截图工具
  server.tool(
    custom.screenshot.schema.name,
    custom.screenshot.schema.description,
    async (params) => {
      debugLog(`➡️ 执行工具: screenshot`, params);
      return await custom.screenshot.handle(context, params);
    }
  );

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

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  debugLog(`🚀 MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});
