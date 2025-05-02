import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// 后端 WebSocket 服务器地址 (与 mcp-context.ts 中 WSS_PORT 一致)
const WS_URL = 'ws://localhost:8081';
// 后端 MCP HTTP 服务器地址 (与 server.ts 中 PORT 一致)
const MCP_API_URL = 'http://localhost:3000/mcp';

function App() {
  const [apiKey] = useState(''); // 存储 API Key
  const [command, setCommand] = useState(''); // 用户输入的自然语言指令
  const [status, setStatus] = useState('等待连接插件...'); // 显示主要连接状态
  const [isConnected, setIsConnected] = useState(false); // 插件连接状态
  const [mcpSessionId, setMcpSessionId] = useState<string | null>(null); // MCP 会话 ID
  const [isProcessing, setIsProcessing] = useState(false); // 是否正在处理指令
  const [logs, setLogs] = useState<string[]>([]); // 存储详细日志
  const ws = useRef<WebSocket | null>(null);
  const eventSource = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null); // 用于自动滚动日志
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID

  // Helper function to add logs
  const addLog = useCallback((message: string) => {
    console.log(message); // Also log to console
    setLogs(prevLogs => [
      ...prevLogs,
      `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${message}`
    ]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- WebSocket 连接逻辑 ---
  const connectWebSocket = useCallback(() => {
    // Prevent multiple concurrent connection attempts or connecting if already connected/connecting
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      console.log(`WebSocket is already ${ws.current.readyState === WebSocket.OPEN ? 'open' : 'connecting'}.`);
      return;
    }
    // Also prevent connection if a reconnect timeout is scheduled
    if (reconnectTimeoutRef.current) {
        console.log('Reconnect already scheduled. Aborting new connection attempt.');
        return;
    }

    // Clear any lingering reconnect timeout just in case (should be redundant but safe)
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    ws.current = new WebSocket(WS_URL);
    setStatus('正在连接插件...');
    addLog('尝试连接 WebSocket...');

    ws.current.onopen = () => {
      addLog('WebSocket 连接成功');
      setStatus('插件已连接');
      setIsConnected(true);
      // Clear reconnect timeout on successful connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.current.onclose = (event) => {
      addLog(`WebSocket 连接断开: Code=${event.code}, Reason=${event.reason || 'N/A'}`);
      setStatus(`插件连接已断开 (${event.code})`);
      setIsConnected(false);
      ws.current = null; // Clear the ref

      // Clear any existing reconnect timeout *before* deciding whether to set a new one
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null; // Ensure ref is cleared after timeout clear
      }

      // Only attempt reconnect if the close was unexpected AND no reconnect is already scheduled
      if (event.code !== 1000 && !reconnectTimeoutRef.current) {
          addLog('5秒后尝试重连 WebSocket...');
          reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null; // Clear ref *before* calling connectWebSocket
              connectWebSocket();
          }, 5000);
      } else if (event.code === 1000) {
          addLog('WebSocket 正常关闭，不尝试重连。');
      } else {
          addLog('WebSocket 关闭，但重连已在计划中或不应重连。'); // Log if reconnect is skipped because timeout exists
      }
    };

    ws.current.onerror = (error) => {
      // Use console.error for errors
      console.error(`WebSocket 错误:`, error);
      addLog(`WebSocket 错误: ${error instanceof Error ? error.message : '未知错误'}`);
      setStatus('插件连接错误');
      setIsConnected(false);
      // Consider attempting reconnect on error as well, depending on desired behavior
      // Maybe add similar logic as onclose here if errors should trigger reconnects
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        addLog(`收到 WebSocket 消息: ${JSON.stringify(message, null, 2)}`); // Pretty print JSON
        // Handle specific messages if needed
        if (message.type === 'statusUpdate') {
          addLog(`插件状态更新: ${message.payload}`);
        }
      } catch (error) {
        console.error(`处理 WebSocket 消息错误:`, error);
        addLog(`处理 WebSocket 消息错误: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };
  }, [addLog]);

  useEffect(() => {
    // Attempt initial connection slightly delayed to potentially mitigate HMR race conditions
    const initialConnectTimeout = setTimeout(() => {
        connectWebSocket();
    }, 100); // Short delay

    return () => {
      clearTimeout(initialConnectTimeout); // Clear initial delay timeout if unmounted quickly
      // Clear reconnect timeout on unmount/cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close WebSocket connection with code 1000 for intentional close
      if (ws.current) {
        addLog('组件卸载，关闭 WebSocket 连接...');
        // Check readyState before closing, avoid errors if already closed
        if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
            ws.current.close(1000, "Component unmounting");
        }
        ws.current = null; // Ensure ref is cleared
      }
      if (eventSource.current) {
        addLog('组件卸载，关闭 EventSource 连接...');
        eventSource.current.close();
        eventSource.current = null;
      }
    };
  }, [connectWebSocket]); // Dependency array remains the same

  // --- MCP 会话和指令处理逻辑 ---
  const initializeMcpSession = async () => {
    if (mcpSessionId) {
      console.log('MCP 会话已存在:', mcpSessionId);
      return mcpSessionId;
    }
    if (!isConnected) {
      addLog('错误：插件未连接，无法初始化 MCP 会话');
      setStatus('错误：插件未连接');
      return null;
    }
    setIsProcessing(true);
    setStatus('正在初始化 MCP...');
    addLog('开始初始化 MCP 会话...');
    try {
      const response = await fetch(MCP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream', // MCP 要求
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: { clientName: 'Browser Plugin UI' }, // 可选参数
          id: `req-${Date.now()}`, // More descriptive request ID
        }),
      });

      const newSessionId = response.headers.get('mcp-session-id');
      if (!response.ok || !newSessionId) {
        let errorData = { message: '无法解析错误响应' };
        try {
          errorData = await response.json();
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(`MCP 初始化失败 (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      console.log('MCP 会话初始化成功:', newSessionId);
      setMcpSessionId(newSessionId);
      setStatus('MCP 会话已建立');
      startEventSource(newSessionId);
      return newSessionId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`初始化 MCP 会话错误:`, error);
      addLog(`初始化 MCP 会话错误: ${errorMsg}`);
      setStatus(`MCP 初始化错误`);
      setMcpSessionId(null);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const startEventSource = (sessionId: string) => {
    if (eventSource.current) {
      eventSource.current.close();
    }
    addLog(`启动 EventSource 监听会话: ${sessionId}`);
    const url = `${MCP_API_URL}?sessionId=${sessionId}`;
    addLog(`连接到 EventSource URL: ${url}`);
    eventSource.current = new EventSource(url);

    eventSource.current.onopen = () => {
      addLog('EventSource 连接成功');
      setStatus('已连接 MCP 事件流');
    };

    eventSource.current.onerror = (error) => {
      console.error(`EventSource 错误:`, error);
      addLog(`EventSource 错误: ${error instanceof Event ? '连接错误' : '未知错误'}`);
      setStatus('MCP 事件流错误');
      if (eventSource.current?.readyState === EventSource.CLOSED) {
         addLog('EventSource 连接已关闭，可能需要重新初始化 MCP 会话');
         setMcpSessionId(null); // Reset session ID
         setStatus('MCP 事件流已断开');
      }
    };

    eventSource.current.onmessage = (event) => {
      addLog(`收到 MCP 事件: ${event.data}`);
      try {
        const data = JSON.parse(event.data);
        if (data.result) {
          addLog(`AI 操作结果: ${JSON.stringify(data.result, null, 2)}`);
          // Optionally update main status too, or keep it for connection status
          // setStatus('AI 操作完成');
        } else if (data.error) {
          addLog(`AI 操作错误: ${data.error.message}`);
          setStatus('AI 操作出错');
        } else {
          // Handle other messages like 'thinking' if the AI/backend sends them
          addLog(`AI 状态: ${JSON.stringify(data, null, 2)}`);
        }
      } catch (error) {
        console.error(`处理 MCP 事件错误:`, error);
        addLog(`处理 MCP 事件错误: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };
  };

  const sendCommandViaApi = async (currentSessionId: string, userCommand: string, userApiKey: string) => {
    setIsProcessing(true);
    setStatus('发送指令给 AI...');
    addLog(`发送指令到后端 API: "${userCommand}"`);
    try {
      const response = await fetch('/api/ai-command', { // 调用后端的新 API 端点
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: userCommand,
          apiKey: userApiKey, // 传递 API Key
          sessionId: currentSessionId, // 传递当前 MCP 会话 ID
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API 请求失败 (${response.status})`);
      }

      addLog(`后端 API 响应: ${result.message || JSON.stringify(result, null, 2)}`);
      setStatus('指令已发送，等待执行...'); // Update main status

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error(`调用 AI API 出错:`, error);
      addLog(`调用 AI API 出错: ${errorMsg}`);
      setStatus(`发送指令错误`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!command.trim()) { // Check for empty or whitespace-only command
      addLog('请输入有效指令');
      return;
    }
    if (isProcessing) {
       addLog('请等待当前操作完成');
       return;
    }
     if (!isConnected) {
      addLog('插件未连接，无法发送指令');
      setStatus('错误：插件未连接');
      return;
    }

    let currentSessionId = mcpSessionId;
    if (!currentSessionId) {
      addLog('MCP 会话不存在，正在尝试初始化...');
      setStatus('正在初始化 MCP...');
      currentSessionId = await initializeMcpSession();
    }

    if (currentSessionId) {
      await sendCommandViaApi(currentSessionId, command, apiKey);
      // Consider clearing command only on success or based on user preference
      // setCommand('');
    } else {
      addLog('无法执行指令，MCP 会话未建立或初始化失败');
      setStatus('MCP 初始化失败');
    }
  };

  // --- UI 渲染 ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 text-gray-100 p-4 font-sans text-sm">
      <div className="w-full max-w-lg bg-gray-800 shadow-xl rounded-lg p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center text-purple-400 mb-6">浏览器 AI 助手</h1>

        {/* 插件连接状态 */}
        <div className={`w-full p-3 rounded-md text-center font-semibold text-white transition-colors duration-300 ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
          {status}
        </div>

        {/* 指令输入表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="command" className="block text-sm font-medium text-gray-300 mb-1">输入指令:</label>
            <textarea
              id="command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例如：在 Bilibili 搜索框输入 Trae AI"
              rows={4} // Increased rows for better visibility
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 resize-y shadow-sm transition duration-150 ease-in-out disabled:opacity-60"
              disabled={isProcessing || !isConnected}
            />
          </div>
          <button
            type="submit"
            disabled={isProcessing || !isConnected || !command.trim()} // Disable if command is empty/whitespace
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out shadow-md flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>正在处理...</span>
              </>
            ) : (
              <span>执行指令</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
