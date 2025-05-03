// AI指令服务接口

// 服务器配置
const API_BASE_URL = 'http://localhost:3000';

// 会话ID管理
let currentSessionId: string | null = null;

export const setSessionId = (sessionId: string) => {
  currentSessionId = sessionId;
};

export const getSessionId = () => currentSessionId;

// AI指令处理接口
export interface AICommandResponse {
  message?: string;
  error?: string;
}

// 发送AI指令到服务器
export const sendAICommand = async (command: string): Promise<AICommandResponse> => {
  if (!currentSessionId) {
    throw new Error('No active session ID found');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        sessionId: currentSessionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process AI command');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending AI command:', error);
    throw error;
  }
};

// 初始化MCP会话
export const initializeMCPSession = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to initialize MCP session');
    }

    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('No session ID received from server');
    }

    setSessionId(sessionId);
    console.log('MCP session initialized with ID:', sessionId);

    // 建立事件流连接
    const eventSource = new EventSource(`${API_BASE_URL}/mcp`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      console.log('Received event:', event.data);
      // 这里可以添加事件处理逻辑
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };

  } catch (error) {
    console.error('Error initializing MCP session:', error);
    throw error;
  }
};