// MCP服务器测试脚本
import fetch from 'node-fetch';

// 服务器地址
const SERVER_URL = 'http://localhost:3000/mcp';

// 测试初始化请求
async function testInitialize() {
  console.log('发送初始化请求...');
  
  const initializeRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      capabilities: {}
    },
    id: 1
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(initializeRequest)
    });

    // 获取会话ID
    const sessionId = response.headers.get('mcp-session-id');
    console.log('会话ID:', sessionId);

    // 检查响应状态
    if (response.ok) {
      const data = await response.json();
      console.log('初始化响应:', JSON.stringify(data, null, 2));
      console.log('✅ 服务器连接成功!');
      return { success: true, sessionId, data };
    } else {
      const errorText = await response.text();
      console.error('❌ 初始化失败:', response.status, errorText);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ 连接错误:', error.message);
    return { success: false };
  }
}

// 测试获取工具列表
async function testGetTools(sessionId) {
  if (!sessionId) {
    console.error('❌ 无法获取工具列表: 缺少会话ID');
    return { success: false };
  }

  console.log('\n发送获取工具列表请求...');
  
  const getToolsRequest = {
    jsonrpc: '2.0',
    method: 'getTools',
    params: {},
    id: 2
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify(getToolsRequest)
    });

    // 检查响应状态
    if (response.ok) {
      const data = await response.json();
      console.log('工具列表响应:', JSON.stringify(data, null, 2));
      console.log('✅ 获取工具列表成功!');
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.error('❌ 获取工具列表失败:', response.status, errorText);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ 连接错误:', error.message);
    return { success: false };
  }
}

// 测试调用工具
async function testCallTool(sessionId, toolName = 'wait') {
  if (!sessionId) {
    console.error('❌ 无法调用工具: 缺少会话ID');
    return { success: false };
  }

  console.log(`\n发送调用工具 ${toolName} 请求...`);
  
  const callToolRequest = {
    jsonrpc: '2.0',
    method: 'callTool',
    params: {
      name: toolName,
      arguments: toolName === 'wait' ? { time: 1 } : {}
    },
    id: 3
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify(callToolRequest)
    });

    // 检查响应状态
    if (response.ok) {
      const data = await response.json();
      console.log('工具调用响应:', JSON.stringify(data, null, 2));
      console.log(`✅ 调用工具 ${toolName} 成功!`);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.error(`❌ 调用工具 ${toolName} 失败:`, response.status, errorText);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ 连接错误:', error.message);
    return { success: false };
  }
}

// 测试关闭会话
async function testCloseSession(sessionId) {
  if (!sessionId) {
    console.error('❌ 无法关闭会话: 缺少会话ID');
    return { success: false };
  }

  console.log('\n发送关闭会话请求...');

  try {
    const response = await fetch(SERVER_URL, {
      method: 'DELETE',
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });

    // 检查响应状态
    if (response.ok) {
      const data = await response.text();
      console.log('关闭会话响应:', data);
      console.log('✅ 关闭会话成功!');
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('❌ 关闭会话失败:', response.status, errorText);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ 连接错误:', error.message);
    return { success: false };
  }
}

// 主函数
async function main() {
  console.log('开始测试MCP服务器...');
  console.log('服务器地址:', SERVER_URL);
  console.log('-----------------------------------');
  
  // 初始化测试
  const initResult = await testInitialize();
  
  if (initResult.success) {
    // 获取工具列表测试
    await testGetTools(initResult.sessionId);
    
    // 调用工具测试
    await testCallTool(initResult.sessionId);
    
    // 关闭会话测试
    await testCloseSession(initResult.sessionId);
  }
  
  console.log('-----------------------------------');
  console.log('测试完成');
}

// 执行测试
main().catch(error => {
  console.error('测试过程中发生错误:', error);
});