// 简单的MCP服务器测试脚本
import fetch from 'node-fetch';

// 服务器地址
const SERVER_URL = 'http://localhost:3000/mcp';

// 初始化请求
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
        'Content-Type': 'application/json'
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
      return { success: true, sessionId };
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

// 测试后续请求
async function testFollowupRequest(sessionId) {
  if (!sessionId) {
    console.error('❌ 无法发送后续请求: 缺少会话ID');
    return;
  }

  console.log('\n发送后续请求...');
  
  const followupRequest = {
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
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify(followupRequest)
    });

    // 检查响应状态
    if (response.ok) {
      const data = await response.json();
      console.log('后续请求响应:', JSON.stringify(data, null, 2));
      console.log('✅ 后续请求成功!');
    } else {
      const errorText = await response.text();
      console.error('❌ 后续请求失败:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ 连接错误:', error.message);
  }
}

// 主函数
async function main() {
  console.log('开始测试MCP服务器...');
  console.log('服务器地址:', SERVER_URL);
  console.log('-----------------------------------');
  
  const initResult = await testInitialize();
  
  if (initResult.success) {
    await testFollowupRequest(initResult.sessionId);
  }
  
  console.log('-----------------------------------');
  console.log('测试完成');
}

// 执行测试
main().catch(error => {
  console.error('测试过程中发生错误:', error);
});