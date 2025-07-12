import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Brain,
  Trash2,
  Copy,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

import { aiService } from '../../lib/ai/ollama-service'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Input } from '../ui/input'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIChatAssistantProps {
  context?: any // Current experiment or sequence context
  className?: string
}

export function AIChatAssistant({ context, className }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your AI CRISPR assistant. Ask me anything about guide RNA design, experimental protocols, troubleshooting, or CRISPR methodology. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) {
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    try {
      const response = await aiService.answerQuestion(
        userMessage.content,
        context,
      )

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI chat failed:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "I apologize, but I'm having trouble processing your question right now. Please try again or check if Ollama is running.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Chat cleared! How can I help you with your CRISPR experiment?',
        timestamp: new Date(),
      },
    ])
  }

  const copyMessage = (content: string) => {
    void navigator.clipboard.writeText(content).catch((error) => {
      console.error('Failed to copy message:', error)
    })
  }

  const quickQuestions = [
    'How do I improve guide RNA efficiency?',
    'What causes off-target effects?',
    'Best practices for CRISPR delivery?',
    'How to validate knockout experiments?',
    'Troubleshooting low editing efficiency',
  ]

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  if (!isExpanded) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`fixed bottom-6 right-6 z-50 ${className}`}
      >
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 w-96 h-[600px] ${className}`}
    >
      <Card className="h-full bg-white/5 border-white/20 backdrop-blur-sm shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">
                  AI Assistant
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  CRISPR Expert
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-400"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Online
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col h-full p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                  >
                    <div
                      className={`p-2 rounded-full ${message.role === 'user' ? 'bg-purple-600' : 'bg-slate-700'}`}
                    >
                      {message.role === 'user' ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-100'}`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {message.role === 'assistant' && (
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyMessage(message.content)}
                              className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-start space-x-2">
                  <div className="p-2 rounded-full bg-slate-700">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="p-3 rounded-lg bg-white/10">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <div
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="p-4 border-t border-white/10">
              <p className="text-slate-400 text-xs mb-2">Quick questions:</p>
              <div className="space-y-1">
                {quickQuestions.slice(0, 3).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question)}
                    className="block w-full text-left text-xs text-slate-300 hover:text-white p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center space-x-2">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about CRISPR..."
                className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
                disabled={isTyping}
              />
              <Button
                onClick={() => void handleSendMessage()}
                disabled={!inputMessage.trim() || isTyping}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                {isTyping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              {messages.length > 1 && (
                <Button
                  onClick={clearChat}
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-slate-400 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
