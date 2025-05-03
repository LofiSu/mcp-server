import express from "express";
import cors from 'cors'; // 引入 cors 中间件
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import * as tools from "./tools/index.js";
import { debugLog } from "./utils/log.js";
import { Context } from "./types/context.js";
import { Tool } from "./types/tools.js";
import { mcpContext } from "./utils/mcp-context.js";
import fetch from 'node-fetch'; // 需要引入 node-fetch 用于后端发送 HTTP 请求

// 创建 Express 应用
const app = express();

// 配置 CORS
const corsOptions = {
  origin: 'http://localhost:5173', // 允许来自前端的请求
  methods: ['GET', 'POST', 'OPTIONS'], // 允许的 HTTP 方法
  allowedHeaders: ['Content-Type', 'Accept', 'Mcp-Session-Id'], // 允许的请求头
  credentials: true, // 允许携带凭证（例如 cookies）
  exposedHeaders: ['Mcp-Session-Id'], // 允许前端访问的响应头
};

app.use(cors(corsOptions));
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
    
    // 1. 创建 MCP Server 实例
    const server = createServer();
    debugLog(`🔧 MCP Server 实例已创建 (会话: ${newSessionId})`);

    // 2. 创建传输实例
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        debugLog(`✅ 会话初始化成功回调: ${id}`);
      }
    });
    debugLog(`🔧 传输实例已创建 (会话: ${newSessionId})`);

    // 3. 存储传输实例
    transports[newSessionId] = transport;
    
    // 4. 设置会话关闭处理
    transport.onclose = () => {
      if (transport.sessionId) {
        debugLog(`❌ 会话关闭: ${transport.sessionId}`);
        // 在这里可以添加清理插件连接的逻辑（如果需要）
        delete transports[transport.sessionId];
      }
    };

    // 5. 连接服务器到传输层
    try {
      debugLog(`⏳ 尝试连接服务器到传输层 (会话: ${newSessionId})...`);
      await server.connect(transport);
      debugLog(`🔌 服务器已成功连接到传输层 (会话: ${newSessionId})`);
    } catch (connectError) {
      debugLog(`❌ 连接服务器到传输层时出错 (会话: ${newSessionId}):`, connectError);
      // 如果连接失败，可能需要清理并返回错误
      delete transports[newSessionId];
      return res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32001, // Custom error code for connection failure
          message: "Internal Server Error: Failed to connect server to transport",
        },
        id: req.body?.id || null,
      });
    }
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
    debugLog(`⏳ 即将处理请求体: ${JSON.stringify(req.body)}`);
    
    // 如果是初始化请求，完全手动处理响应
    if (isInitialize) {
      // 手动设置响应，确保状态码为200
      res.status(200);
      
      // 不调用transport.handleRequest，而是直接手动处理初始化请求
      // 这样可以避免响应头被发送两次
      debugLog(`✅ 初始化请求处理完成，手动发送响应: ${method}`);
      
      // 手动发送JSON-RPC成功响应
      return res.json({
        jsonrpc: "2.0",
        result: { capabilities: { /* 服务器能力 */ } },
        id: req.body?.id || 1
      });
    } else {
      // 非初始化请求正常处理
      await transport.handleRequest(req, res, req.body);
      debugLog(`✅ 请求处理完成: ${method}`);
    }
  } catch (error) {
    debugLog(`❌ 处理 MCP 请求时出错 (${method}):`, error);
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
  // 优先从 Header 获取 sessionId，如果不存在（例如 EventSource GET 请求），则从查询参数获取
  let sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId && req.method === 'GET' && req.query.sessionId) {
    sessionId = req.query.sessionId as string;
    debugLog(`ℹ️ 从查询参数获取 Session ID: ${sessionId}`);
  }

  // 第一步：验证会话ID是否存在
  if (!sessionId) {
    debugLog(`❌ 无效会话请求: 缺少sessionId`);
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Missing session ID",
      },
      id: null,
    });
  }

  // 第二步：验证会话ID是否在transports中存在
  if (!transports[sessionId]) {
    debugLog(`❌ 无效会话请求: sessionId=${sessionId} 在transports中不存在`);
    debugLog(`当前有效的会话IDs: ${Object.keys(transports).join(', ') || '无'}`);
    
    // 检查是否是大小写问题 - MCP会话ID通常是UUID，可能存在大小写不一致的情况
    const lowerCaseSessionId = sessionId.toLowerCase();
    const matchingSessionId = Object.keys(transports).find(
      id => id.toLowerCase() === lowerCaseSessionId
    );
    
    if (matchingSessionId) {
      debugLog(`✅ 找到匹配的会话ID (大小写不敏感): ${matchingSessionId}`);
      sessionId = matchingSessionId; // 使用找到的匹配ID
    } else {
      debugLog(`❌ 即使进行大小写不敏感匹配，也找不到有效的会话ID: ${sessionId}`);
      // 根据MCP协议规范，如果会话ID无效，应返回404而不是400
      return res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Session not found",
        },
        id: null,
      });
    }
  } else {
    debugLog(`✅ 会话ID直接匹配成功: ${sessionId}`);
  }
  
  // 验证 Accept 头部 (仅对 GET 请求)
  if (req.method === "GET") {
    const acceptHeader = req.headers.accept || "";
    debugLog(`📝 请求的Accept头部: ${acceptHeader}`);
    
    // 根据MCP协议规范，EventSource连接请求的Accept头部必须包含text/event-stream
    if (!acceptHeader.includes("text/event-stream")) {
      debugLog(`❌ GET 请求缺少有效的 Accept 头部: ${acceptHeader}`);
      return res.status(406).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Not Acceptable: Client must accept text/event-stream",
        },
        id: null,
      });
    }
  }
  
  debugLog(`✅ 会话请求验证通过: ${sessionId}`);
  res.setHeader("Mcp-Session-Id", sessionId);
  
  try {
    const transport = transports[sessionId];
    // 确保transport存在
    if (!transport) {
      debugLog(`❌ 无法找到会话ID对应的transport: ${sessionId}`);
      return res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Session transport not found",
        },
        id: null,
      });
    }
    debugLog(`⏳ 开始处理会话请求: ${req.method} ${req.url}`);
    await transport.handleRequest(req, res);
    debugLog(`✅ 会话请求处理完成: ${req.method} ${req.url}`);
  } catch (error) {
    debugLog(`❌ 处理会话请求时出错: ${error}`);
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

// 新增 API 端点处理前端指令
app.post('/api/ai-command', async (req, res) => {
  const { command, apiKey, sessionId } = req.body;

  console.log(`[API /api/ai-command] Received command: "${command}", Session ID: ${sessionId}`);

  // --- 输入验证 ---
  if (!command || typeof command !== 'string') {
    console.error('[API /api/ai-command] Error: Missing or invalid command');
    return res.status(400).json({ error: 'Missing or invalid command' });
  }
  // 实际应用中应验证 apiKey
  // if (!apiKey) {
  //   return res.status(401).json({ error: 'Missing API Key' });
  // }
  if (!sessionId || typeof sessionId !== 'string') {
    console.error('[API /api/ai-command] Error: Missing or invalid sessionId');
    return res.status(400).json({ error: 'Missing or invalid sessionId' });
  }

  // --- 会话验证 ---
  // 检查会话是否存在 (在实际应用中，需要更完善的会话管理)
  // 这里我们假设 sessionId 总是有效的，因为前端会初始化
  // if (!isValidSession(sessionId)) { // 需要实现 isValidSession
  //   return res.status(404).json({ error: 'Session not found or invalid' });
  // }

  // --- 模拟 AI 处理 --- (替换为实际的 AI 调用)
  let mcpRequestPayload: any;
  try {
    console.log(`[API /api/ai-command] Simulating AI processing for command: "${command}"`);
    // 简单的基于关键词的模拟 AI 响应
    const lowerCaseCommand = command.toLowerCase();

    if (lowerCaseCommand.includes('bilibili') && lowerCaseCommand.includes('搜索框') && lowerCaseCommand.includes('输入')) {
      const searchTextMatch = command.match(/输入\s*(.+)/i);
      const searchText = searchTextMatch ? searchTextMatch[1].trim() : 'Trae AI'; // 默认搜索词
      mcpRequestPayload = {
        tool: 'typeText',
        args: {
          selector: '#nav-search-input', // Bilibili 搜索框选择器
          text: searchText,
          options: { delay: 50 } // 模拟打字延迟
        }
      };
      console.log(`[API /api/ai-command] AI Simulation: Generated 'typeText' for Bilibili search input: "${searchText}"`);
    } else if (lowerCaseCommand.includes('导航到') || lowerCaseCommand.includes('打开')) {
        let urlMatch = command.match(new RegExp('https:\/\/\S+', 'i'));
        let targetUrl = 'https://www.google.com'; // Default URL

        if (!urlMatch) { // If full URL not found, try matching "打开 ..."
            urlMatch = command.match(new RegExp('打开\\s+([^\\s]+)', 'i'));
        }

        if (urlMatch && urlMatch[1]) {
            targetUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://${urlMatch[1]}`;
        } else if (lowerCaseCommand.includes('bilibili')) {
            targetUrl = 'https://www.bilibili.com';
        }
        mcpRequestPayload = {
            tool: 'navigate',
            args: { url: targetUrl }
        };
        console.log(`[API /api/ai-command] AI Simulation: Generated 'navigate' to URL: ${targetUrl}`);
    } else if (lowerCaseCommand.includes('点击') || lowerCaseCommand.includes('单击')) {
        // 非常简化的点击模拟，假设用户指定了选择器或明确文本
        const selectorMatch = command.match(/(选择器|selector)\s*['"]([^'"]+)['"]/i);
        const textMatch = command.match(/文本为?['"]([^'"]+)['"]/i);
        let selector = 'button'; // Default selector
        if (selectorMatch && selectorMatch[2]) {
            selector = selectorMatch[2];
        } else if (textMatch && textMatch[1]) {
            // 尝试生成基于文本的选择器 (非常基础)
            selector = `button:contains("${textMatch[1]}"), a:contains("${textMatch[1]}")`; // 示例
        }
        mcpRequestPayload = {
            tool: 'click',
            args: { selector: selector }
        };
        console.log(`[API /api/ai-command] AI Simulation: Generated 'click' on selector: ${selector}`);

    } else if (lowerCaseCommand.includes('快照') || lowerCaseCommand.includes('截图') || lowerCaseCommand.includes('页面状态')) {
      mcpRequestPayload = {
        tool: 'snapshot', // 假设我们有一个 'snapshot' 工具
        args: {} // 可能不需要参数，或者可以指定截图区域等
      };
      console.log(`[API /api/ai-command] AI Simulation: Generated 'snapshot' request`);
    } else {
      // 默认或无法识别的指令，可以返回一个提示或默认操作
      console.log(`[API /api/ai-command] AI Simulation: Command not recognized, generating default 'getConsoleLogs'`);
      mcpRequestPayload = {
        tool: 'getConsoleLogs',
        args: {}
      };
    }

    // --- 发送 MCP 请求到 /mcp 端点 ---
    if (mcpRequestPayload) {
      const mcpUrl = `http://localhost:${PORT}/mcp`; // MCP 服务器在本机
      console.log(`[API /api/ai-command] Sending MCP request to ${mcpUrl} with payload:`, mcpRequestPayload);

      // 使用 node-fetch 发送 POST 请求
      const mcpResponse = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Session-ID': sessionId // 将会话 ID 传递给 MCP 服务器
        },
        body: JSON.stringify(mcpRequestPayload)
      });

      if (!mcpResponse.ok) {
        const errorText = await mcpResponse.text();
        console.error(`[API /api/ai-command] Error sending MCP request: ${mcpResponse.status} ${mcpResponse.statusText}`, errorText);
        throw new Error(`MCP request failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
      }

      // MCP 响应通常是流式的，这里我们只确认请求已发送
      // 实际结果会通过 EventSource 推送给前端
      console.log(`[API /api/ai-command] MCP request sent successfully to session ${sessionId}`);
      res.status(200).json({ message: 'Command received and forwarded to MCP' });

    } else {
      console.log('[API /api/ai-command] No MCP payload generated for the command.');
      res.status(200).json({ message: 'Command received, but no action taken by AI simulation.' });
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown AI processing error';
    console.error(`[API /api/ai-command] Error processing command: ${errorMsg}`, error);
    res.status(500).json({ error: `Failed to process command: ${errorMsg}` });
  }
});

// 启动HTTP服务器（不再自动启动浏览器和WebSocket，由插件负责连接）
const PORT = 3000;
app.listen(PORT, () => {
  debugLog(`🚀 MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
  debugLog(`🔗 API Endpoint for AI commands available at POST /api/ai-command`);
  debugLog(`🔌 等待浏览器插件连接 WebSocket at ws://localhost:8081 ...`);
});

// 移除进程退出时关闭浏览器的逻辑
process.on('SIGINT', async () => {
  debugLog('👋 正在关闭服务器...');
  // 不再需要关闭 browserAutomation 和 browserConnector
  process.exit(0);
});
