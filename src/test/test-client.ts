/**
 * MCP 客户端测试脚本
 * 用于测试 MCP 服务器是否正常工作
 */
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomUUID } from 'crypto';
import { infoLog, errorLog } from '../utils/log.js';

/**
 * 测试 MCP 服务器
 */
async function testMcpServer() {
  try {
    // 服务器地址
    const serverUrl = 'http://localhost:3000/mcp';
    infoLog(`🔗 连接到 MCP 服务器: ${serverUrl}`);
    
    // 创建会话 ID
    const sessionId = randomUUID();
    infoLog(`🆔 会话 ID: ${sessionId}`);
    
    // 创建传输层
    const transport = new StreamableHTTPClientTransport({
      url: serverUrl,
      sessionId: sessionId,
    });
    
    // 创建客户端
    const client = new McpClient();
    
    // 连接到服务器
    await client.connect(transport);
    infoLog('✅ 成功连接到服务器');
    
    // 初始化会话
    const initResult = await client.initialize();
    infoLog('✅ 会话初始化成功', initResult);
    
    // 获取可用工具列表
    const tools = client.getTools();
    infoLog(`🧰 可用工具列表 (${tools.length} 个):`, tools.map(t => t.name));
    
    // 测试调用工具 - 以 navigate 为例
    if (tools.some(t => t.name === 'navigate')) {
      infoLog('🔍 测试 navigate 工具...');
      const navigateResult = await client.callTool('navigate', { url: 'https://example.com' });
      infoLog('✅ navigate 工具调用成功', navigateResult);
    }
    
    // 关闭会话
    await client.close();
    infoLog('👋 会话已关闭');
    
    return true;
  } catch (error) {
    errorLog('❌ 测试失败', error);
    return false;
  }
}

// 执行测试
testMcpServer().then(success => {
  if (success) {
    infoLog('🎉 MCP 服务器测试成功!');
    process.exit(0);
  } else {
    errorLog('💔 MCP 服务器测试失败!');
    process.exit(1);
  }
});