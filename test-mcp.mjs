import fetch from 'node-fetch';

// MCP服务器地址
const MCP_SERVER = 'http://localhost:3000/mcp';

// 生成唯一请求ID
let requestId = 0;
function generateRequestId() {
    return (++requestId).toString();
}

// 发送MCP请求的函数
async function sendMcpRequest(method, params = {}, sessionId = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
    };
    
    if (sessionId) {
        headers['mcp-session-id'] = sessionId;
        console.log(`请求头设置会话ID: ${sessionId}`);
    }
    
    console.log(`发送请求 ${method}，使用会话ID: ${sessionId}`);
    const response = await fetch(MCP_SERVER, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: generateRequestId()
        })
    });

    // 检查所有响应头
    console.log('所有响应头:');
    let foundSessionId = null;
    response.headers.forEach((value, name) => {
        console.log(`${name}: ${value}`);
        // 检查所有可能的会话ID头名称（不区分大小写）
        if (name.toLowerCase() === 'mcp-session-id') {
            foundSessionId = value;
            console.log(`找到会话ID响应头: ${name} = ${value}`);
        }
    });

    const result = await response.json();
    
    // 尝试多种可能的大小写形式获取会话ID
    const headerSessionId = foundSessionId || 
                           response.headers.get('mcp-session-id') || 
                           response.headers.get('Mcp-Session-Id') || 
                           response.headers.get('MCP-SESSION-ID');
    
    // 优先使用传入的会话ID，如果没有则使用响应头中的会话ID
    const newSessionId = sessionId || headerSessionId;
    console.log(`请求 ${method} 使用的会话ID: ${sessionId}, 响应头会话ID: ${headerSessionId}`);
    
    return { result, sessionId: newSessionId };
}

// 测试函数
async function testMcp() {
    try {
        // 0. 初始化服务器
        console.log('初始化服务器...');
        const { result: initResult, sessionId } = await sendMcpRequest('initialize', {
            capabilities: {
                browser: true,
                screenshot: true,
                console: true
            },
            clientInfo: {
                name: 'mcp-test-client',
                version: '1.0.0'
            }
        });
        console.log('初始化结果:', initResult);
        console.log('Session ID:', sessionId);

        // 后续测试...
        // 1. 测试获取控制台日志
        console.log('测试 getConsoleLogs...');
        const { result: logsResult } = await sendMcpRequest('getConsoleLogs', {}, sessionId);
        console.log('结果:', logsResult);

        // 2. 测试截图功能
        console.log('\n测试 screenshot...');
        const { result: screenshotResult } = await sendMcpRequest('screenshot', {}, sessionId);
        console.log('结果:', screenshotResult);

        // 3. 测试导航功能
        console.log('\n测试 navigate...');
        const { result: navigateResult } = await sendMcpRequest('navigate', {
            url: 'https://www.example.com'
        }, sessionId);
        console.log('结果:', navigateResult);

        // 4. 测试等待功能
        console.log('\n测试 wait...');
        const { result: waitResult } = await sendMcpRequest('wait', {
            time: 1
        }, sessionId);
        console.log('结果:', waitResult);

    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

// 运行测试
testMcp();