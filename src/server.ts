import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import * as common from "./tools/common.js";
import * as snapshot from "./tools/snapshot.js";
import * as custom from "./tools/custom.js";

// 创建 Express 应用
const app = express();
app.use(express.json());

// 存储会话传输实例
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// 工厂函数：创建 MCP Server 实例
const createServer = () => {
  const server = new McpServer({
    name: "Browser MCP",
    version: "1.0.0",
  });

  // 创建完整的 context 对象
  const context = {
    socket: null as any,
    async sendSocketMessage(type: string, payload: any) {
      console.log(`📤 发送 socket 消息: ${type}`, payload);
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

  // 工具注册
  const commonTools = [common.pressKey, common.wait];
  const customTools = [custom.getConsoleLogs, custom.screenshot];
  const snapshotTools = [
    common.navigate(true),
    common.goBack(true),
    common.goForward(true),
    snapshot.snapshot,
    snapshot.click,
    snapshot.hover,
    snapshot.type,
    snapshot.selectOption,
    ...commonTools,
    ...customTools,
  ];

  // 注册所有工具方法到 MCP
  snapshotTools.forEach((tool) => {
    server.tool(tool.schema.name, tool.schema.description, async (extra) => {
      console.log(`➡️ 执行工具方法: ${tool.schema.name}`, extra);
      const result = await tool.handle(context, extra);
      return result;
    });
  });
  
  

  return server;
};

// POST /mcp - 处理 JSON-RPC 请求
app.post("/mcp", async (req, res) => {
  // 检查现有会话ID
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const method = req.body?.method;
  const isInitialize = method === "initialize";
  console.log(`📩 收到方法: ${method}，Session: ${sessionId}`);

  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // 复用现有传输实例
    transport = transports[sessionId];
    console.log(`✅ 使用现有会话: ${sessionId}`);
    
    // 确保响应头中包含会话ID
    res.setHeader("Mcp-Session-Id", sessionId);
    console.log(`📤 设置响应头会话ID: ${sessionId}`);
  } else if (!sessionId && isInitialize) {
    // 新的初始化请求
    const newSessionId = randomUUID();
    console.log(`🆕 生成新会话ID: ${newSessionId}`);
    
    // 在响应头中设置会话ID - 必须在handleRequest之前设置
    res.setHeader("Mcp-Session-Id", newSessionId);
    console.log(`📤 设置响应头会话ID: ${newSessionId}`);
    
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (newId) => {
        console.log("✅ 会话初始化成功:", newId);
        // 存储传输实例，以便后续请求使用
        transports[newId] = transport;
      }
    });

    // 清理传输实例，当会话关闭时
    transport.onclose = () => {
      if (transport.sessionId) {
        console.log("❌ 会话关闭:", transport.sessionId);
        delete transports[transport.sessionId];
      }
    };

    const server = createServer();
    await server.connect(transport);
  } else {
    // 无效请求 - 没有会话ID或不是初始化请求
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: Server not initialized',
      },
      id: null,
    });
    return;
  }

  try {
    // 处理请求前确保Content-Type正确设置
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    // 处理请求
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// 可重用的会话请求处理函数
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Invalid or missing session ID',
      },
      id: null,
    });
    return;
  }
  
  // 在响应头中设置会话ID - 必须在handleRequest之前设置
  res.setHeader("Mcp-Session-Id", sessionId);
  // 确保Content-Type正确设置
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }
  console.log(`📤 设置响应头会话ID: ${sessionId}`);
  
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
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
  console.log(`🚀 MCP Server listening on port ${PORT}`);
});
