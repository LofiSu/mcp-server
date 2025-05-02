# MCP 服务器与浏览器集成

这个项目实现了一个Model Context Protocol (MCP) 服务器，并集成了浏览器自动化功能，使MCP客户端能够控制浏览器。

## 功能特点

- 基于Express的MCP服务器
- 使用Playwright进行浏览器自动化
- WebSocket连接浏览器与服务器
- 支持导航、交互、快照等浏览器操作

## 安装依赖

```bash
pnpm install
```

## 启动服务器

```bash
pnpm dev
```

启动后，服务器将：
1. 在端口3000上启动HTTP服务器
2. 在端口8080上启动WebSocket服务器
3. 自动启动浏览器并连接到WebSocket服务器

## 运行测试客户端

在另一个终端窗口中运行：

```bash
pnpm tsx src/test/test-client.ts
```

测试客户端将连接到MCP服务器，并执行以下操作：
1. 导航到指定URL
2. 获取页面快照

## 项目结构

- `src/server.ts` - MCP服务器主文件
- `src/test/test-client.ts` - 测试客户端
- `src/tools/` - 工具实现目录
- `src/utils/` - 工具函数和辅助类
  - `browser-connector.ts` - WebSocket服务器实现
  - `browser-automation.ts` - Playwright浏览器自动化
  - `mcp-context.ts` - MCP上下文，提供与浏览器通信的接口

## 注意事项

- 确保端口3000和8080未被其他应用占用
- 首次运行时，Playwright可能需要下载浏览器，这可能需要一些时间