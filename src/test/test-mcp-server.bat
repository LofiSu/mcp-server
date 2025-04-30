@echo off
echo MCP服务器测试脚本 (使用curl)
echo 服务器地址: http://localhost:3000/mcp
echo -----------------------------------

:: 设置服务器地址
set SERVER_URL=http://localhost:3000/mcp

echo 发送初始化请求...

:: 初始化请求
curl -s -X POST %SERVER_URL% ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"params\":{\"capabilities\":{}},\"id\":1}" ^
  -i > init_response.txt

:: 提取会话ID
findstr /C:"mcp-session-id" init_response.txt > session_id.txt
for /f "tokens=2 delims=:" %%a in (session_id.txt) do (
  set SESSION_ID=%%a
  set SESSION_ID=!SESSION_ID: =!
)

echo 会话ID: %SESSION_ID%

:: 显示初始化响应
echo 初始化响应:
type init_response.txt

echo.
echo 发送获取工具列表请求...

:: 获取工具列表请求
curl -s -X POST %SERVER_URL% ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -H "Mcp-Session-Id: %SESSION_ID%" ^
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getTools\",\"params\":{},\"id\":2}" > tools_response.txt

:: 显示工具列表响应
echo 工具列表响应:
type tools_response.txt

echo.
echo 发送调用工具请求...

:: 调用工具请求
curl -s -X POST %SERVER_URL% ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json, text/event-stream" ^
  -H "Mcp-Session-Id: %SESSION_ID%" ^
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"callTool\",\"params\":{\"name\":\"wait\",\"arguments\":{\"time\":1}},\"id\":3}" > tool_response.txt

:: 显示工具调用响应
echo 工具调用响应:
type tool_response.txt

echo.
echo 发送关闭会话请求...

:: 关闭会话请求
curl -s -X DELETE %SERVER_URL% ^
  -H "Mcp-Session-Id: %SESSION_ID%" > close_response.txt

:: 显示关闭会话响应
echo 关闭会话响应:
type close_response.txt

echo.
echo -----------------------------------
echo 测试完成

:: 清理临时文件
del init_response.txt session_id.txt tools_response.txt tool_response.txt close_response.txt

pause