import { useState } from "react"
import { Play, Clock, Settings, Loader2 } from "lucide-react"
import ThinkingDots from "./components/thinking-dots"
import EnvConfigModal from "./components/env-config-modal"
import HistoryModal from "./components/history-modal"


export default function InBrowserMcp() {
  const [showEnvConfig, setShowEnvConfig] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [history, setHistory] = useState<Array<{ id: number; command: string; timestamp: string; result: string }>>([])  

  const clearHistory = () => {
    setHistory([])
  }

  const deleteHistoryItem = (id: number) => {
    setHistory((prev) => prev.filter(item => item.id !== id))
  }

  // 执行命令
  const executeCommand = () => {
    if (!inputValue.trim()) return

    // 开始思考动画
    setIsThinking(true)
    setResult(null)

    // 模拟API调用延迟
    setTimeout(() => {
      let response = ""

      // 根据输入的命令返回不同的结果
      if (inputValue.includes("打开谷歌浏览器")) {
        response = "已执行：打开谷歌浏览器\n\n✅ 谷歌浏览器已成功启动\n\n您可以继续输入命令控制浏览器行为。"
      } else if (inputValue.toLowerCase().includes("google") || inputValue.includes("谷歌")) {
        response =
          "已执行：打开谷歌网站\n\n✅ 已在浏览器中导航至 https://www.google.com\n\n页面加载完成，可以进行后续操作。"
      } else if (inputValue.includes("截图")) {
        response =
          "已执行：网页截图\n\n✅ 截图已完成\n\n截图已保存至默认下载目录，文件名：screenshot_" +
          new Date().getTime() +
          ".png"
      } else {
        response = `已尝试执行：${inputValue}\n\n⚠️ 命令已发送，但未能识别具体操作\n\n请尝试更明确的指令，例如"打开网站"、"点击按钮"等。`
      }

      // 更新结果
      setResult(response)

      // 添加到历史记录
      const newHistoryItem = {
        id: Date.now(),
        command: inputValue,
        timestamp: new Date().toLocaleString(),
        result: response,
      }

      setHistory((prev) => [newHistoryItem, ...prev])

      // 结束思考动画
      setIsThinking(false)
    }, 2000) // 2秒后显示结果
  }

  return (
    <div className="max-w-3xl mx-auto p-4 bg-gradient-to-b from-pink-50 to-purple-50 min-h-screen rounded-lg">
      {/* Header with cute design */}
      <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl shadow-sm border border-pink-200">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-transparent bg-clip-text">
            InBrowserMcp
          </h1>
        </div>
      </div>

      {/* Title with Settings Button */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-pink-200 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-800">
          AI驱动的浏览器自动化工具
          <a href="#" className="text-blue-500 hover:text-blue-600 ml-2 text-sm underline decoration-dotted">
            了解更多
          </a>
        </h2>
        <button
          onClick={() => setShowEnvConfig(true)}
          className="bg-gradient-to-r from-pink-400 to-purple-400 p-2 rounded-full text-white shadow-sm hover:shadow-md transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Input Area */}
      <div className="border border-pink-200 rounded-xl p-4 mb-6 relative bg-white shadow-sm">
        <div className="flex items-start">
          <div className="p-1 text-pink-400 mr-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <textarea
            className="flex-1 outline-none resize-none min-h-[40px] bg-transparent"
            placeholder="请输入您想要执行的操作..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                executeCommand()
              }
            }}
            disabled={isThinking}
          />
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            className={`bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-full px-4 py-1.5 flex items-center shadow-md hover:shadow-lg transition-all text-sm min-w-[80px] justify-center`}
            onClick={executeCommand}
            disabled={isThinking}
          >
            {isThinking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                运行中
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1 fill-white" />
                运行
              </>
            )}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full p-1.5 flex items-center shadow-sm hover:shadow transition-all"
            disabled={isThinking}
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results Area */}
      <div className="border border-pink-200 rounded-xl p-4 min-h-[300px] bg-white shadow-sm">
        <div className="flex items-center mb-3">
          <div className="w-3 h-3 rounded-full bg-pink-400 mr-1 animate-pulse"></div>
          <div className="w-3 h-3 rounded-full bg-purple-400 mr-1 animate-pulse delay-100"></div>
          <div className="w-3 h-3 rounded-full bg-blue-400 mr-1 animate-pulse delay-200"></div>
          <h3 className="text-sm font-medium text-gray-700 ml-2">模型输出</h3>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg min-h-[250px] text-gray-600 whitespace-pre-line">
          {isThinking ? (
            <div className="flex items-center">
              <span className="text-gray-500">思考中</span>
              <ThinkingDots />
            </div>
          ) : result ? (
            <div className="animate-fadeIn">{result}</div>
          ) : (
            "这里将显示模型的思考过程和结果"
          )}
        </div>
      </div>

      {/* Environment Config Modal */}
      {showEnvConfig && <EnvConfigModal onClose={() => setShowEnvConfig(false)} />}

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          history={history}
          onClearHistory={clearHistory}
          onDeleteHistoryItem={deleteHistoryItem}
        />
      )}
    </div>
  )
}
