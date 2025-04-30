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
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const method = req.body?.method;
  console.log(`📩 收到方法: ${method}，Session: ${sessionId}`);

  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
    console.log(`✅ 使用现有会话: ${sessionId}`);
  } else {
    // 创建新的传输实例
    const newSessionId = randomUUID();
    console.log(`🆕 生成新会话ID: ${newSessionId}`);
    
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (newId) => {
        console.log("✅ 会话初始化成功:", newId);
        transports[newId] = transport;
        
        // 确保响应头中包含会话ID
        if (method === "initialize" && !res.headersSent) {
          res.setHeader("Mcp-Session-Id", newId);
          console.log(`📤 设置响应头会话ID: ${newId}`);
        }
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        console.log("❌ 会话关闭:", transport.sessionId);
        delete transports[transport.sessionId];
      }
    };

    const server = createServer();
    await server.connect(transport);
  }

  // 在处理请求前确保会话ID已设置到响应头中
  if (transport.sessionId && !res.headersSent) {
    res.setHeader("Mcp-Session-Id", transport.sessionId);
    console.log(`📤 处理请求前设置响应头会话ID: ${transport.sessionId}`);
  }

  await transport.handleRequest(req, res, req.body);
  
  // 在处理请求后再次确认会话ID是否已设置
  if (transport.sessionId && !res.headersSent) {
    res.setHeader("Mcp-Session-Id", transport.sessionId);
    console.log(`📤 处理请求后设置响应头会话ID: ${transport.sessionId}`);
  }
});

// GET /mcp - 客户端从服务端获取事件流
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send("Invalid or missing session ID");
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// DELETE /mcp - 主动关闭会话
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send("Invalid or missing session ID");
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server listening on port ${PORT}`);
});
