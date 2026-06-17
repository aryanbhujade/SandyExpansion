import React, { useState, useRef, useEffect } from 'react';
import { GradientBarsBackground } from '@/components/ui/gradient-bars-background';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Bot, Sparkles, Search, Users, Code, Lightbulb, RotateCcw, Mail, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, type Variants } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatContext } from '@/context/ChatContext';

const suggestionChips = [
  { icon: <Search size={14} />, text: "Find React experts" },
  { icon: <Users size={14} />, text: "Who knows AWS?" },
  { icon: <Code size={14} />, text: "Python mentors" },
  { icon: <Lightbulb size={14} />, text: "ML project leads" },
];

export default function ChatPage() {
  const navigate = useNavigate();
  const { messages, isTyping, sendMessage, confirmRecommendation, clearChat, backendAvailable } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText) return;
    setInputValue('');
    sendMessage(messageText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <GradientBarsBackground 
      numBars={15} 
      gradientFrom="rgba(52, 211, 153, 0.25)" 
    >
      {/* Top Navigation */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center z-50 pointer-events-none"
      >
        <Button 
          variant="outline" 
          className="text-emerald-400 border-emerald-500/20 bg-black/40 backdrop-blur-md hover:text-emerald-300 hover:bg-emerald-950/40 hover:border-emerald-500/40 transition-all rounded-full pointer-events-auto"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <div className="flex items-center gap-2 pointer-events-auto">
          {backendAvailable !== null && (
            <Badge variant="outline" className={`text-[10px] rounded-full px-2.5 py-1 font-medium ${
              backendAvailable 
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400' 
                : 'border-amber-500/30 bg-amber-950/20 text-amber-400'
            } backdrop-blur-md`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
                backendAvailable ? 'bg-emerald-400' : 'bg-amber-400'
              }`}></span>
              {backendAvailable ? 'API Connected' : 'Demo Mode'}
            </Badge>
          )}
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md text-emerald-400 text-xs rounded-full px-3 py-1.5 font-medium">
            <Sparkles size={12} className="mr-1.5" />
            AI Powered
          </Badge>
        </div>
      </motion.div>

      {/* Main Chat Interface */}
      <div className="w-full h-full flex items-center justify-center pt-20 pb-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="w-full max-w-4xl h-[85vh]"
        >
          <Card className="w-full h-full flex flex-col bg-black/50 backdrop-blur-2xl border-emerald-500/10 shadow-[0_0_80px_-20px_rgba(52,211,153,0.15)] rounded-2xl overflow-hidden">
            {/* Header */}
            <CardHeader className="border-b border-emerald-500/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 border border-emerald-500/30 bg-emerald-950/50 shadow-[0_0_15px_-3px_rgba(52,211,153,0.3)]">
                    <AvatarFallback className="bg-transparent text-emerald-400">
                      <Bot size={20} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">InternBot</h2>
                    <p className="text-xs text-emerald-400/80 font-medium flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]"></span>
                      Online — Ready to help
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-full h-8 w-8 transition-colors"
                          onClick={clearChat}
                        >
                          <RotateCcw size={14} />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-zinc-300 text-xs">
                      Clear chat
                    </TooltipContent>
                  </Tooltip>
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-950/20 text-emerald-400/70 text-[10px] rounded-full px-2.5 py-1">
                    v1.0
                  </Badge>
                </div>
              </div>
            </CardHeader>

            {/* Chat Messages */}
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full w-full p-4 md:p-6">
                <div className="flex flex-col space-y-5">
                  {messages.map((message) => (
                    <motion.div 
                      key={message.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[85%] md:max-w-[75%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <Avatar className={`h-8 w-8 mt-1 shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'} border ${
                          message.role === 'user' 
                            ? 'border-zinc-700 bg-zinc-800' 
                            : 'border-emerald-500/30 bg-emerald-950/50 shadow-[0_0_10px_-3px_rgba(52,211,153,0.2)]'
                        }`}>
                          <AvatarFallback className="bg-transparent">
                            {message.role === 'user' 
                              ? <User size={14} className="text-zinc-400" /> 
                              : <Bot size={14} className="text-emerald-400" />
                            }
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Bubble */}
                        <div 
                          className={`p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                            message.role === 'user' 
                              ? 'bg-zinc-800/90 text-white rounded-tr-sm border border-zinc-700/50' 
                              : 'bg-emerald-950/30 text-emerald-50 rounded-tl-sm border border-emerald-500/15'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">
                            {message.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                              part.startsWith('**') && part.endsWith('**')
                                ? <span key={i} className="font-semibold text-emerald-300">{part.slice(2, -2)}</span>
                                : <span key={i}>{part}</span>
                            )}
                          </div>

                          {message.role === 'bot' && message.confirmationPrompt && message.recommendationId && message.notificationStatus !== 'sent' && (
                            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-black/25 p-3">
                              <p className="text-xs leading-relaxed text-emerald-100/85">
                                {message.confirmationPrompt}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                                  disabled={message.notificationStatus === 'sending'}
                                  onClick={() => confirmRecommendation(message.id, message.recommendationId!)}
                                >
                                  {message.notificationStatus === 'sending' ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  {message.notificationStatus === 'sending' ? 'Notifying...' : 'Notify contact'}
                                </Button>
                                {message.notificationStatus === 'error' && (
                                  <span className="inline-flex items-center text-xs text-amber-300">
                                    <AlertCircle className="mr-1 h-3.5 w-3.5" />
                                    {message.notificationMessage}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {message.role === 'bot' && message.notificationStatus === 'sent' && (
                            <div className="mt-4 inline-flex max-w-full items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{message.notificationMessage}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Suggestion Chips — shown only at start */}
                  {messages.length <= 1 && !isTyping && (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="flex flex-wrap gap-2 pt-2 pl-11"
                    >
                      {suggestionChips.map((chip, idx) => (
                        <motion.div key={idx} variants={itemVariants}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-emerald-500/20 bg-emerald-950/15 text-emerald-300 hover:bg-emerald-950/30 hover:border-emerald-500/40 hover:text-emerald-200 rounded-full text-xs transition-all"
                            onClick={() => handleSendMessage(chip.text)}
                          >
                            <span className="mr-1.5 text-emerald-400">{chip.icon}</span>
                            {chip.text}
                          </Button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  
                  {isTyping && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex w-full justify-start"
                    >
                      <div className="flex max-w-[80%] flex-row">
                        <Avatar className="h-8 w-8 mt-1 shrink-0 mr-3 border border-emerald-500/30 bg-emerald-950/50">
                          <AvatarFallback className="bg-transparent">
                            <Bot size={14} className="text-emerald-400" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="px-5 py-4 rounded-2xl bg-emerald-950/30 text-emerald-400 rounded-tl-sm border border-emerald-500/15 flex items-center space-x-1.5 shadow-lg">
                          <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={scrollRef} className="h-1" />
                </div>
              </ScrollArea>
            </CardContent>

            {/* Separator */}
            <Separator className="bg-emerald-500/10" />

            {/* Input Area */}
            <CardFooter className="bg-black/30 p-4">
              <div className="flex w-full items-center space-x-2 bg-zinc-900/60 border border-emerald-500/10 rounded-full p-1.5 pl-5 focus-within:ring-1 focus-within:ring-emerald-500/40 focus-within:border-emerald-500/30 transition-all shadow-inner">
                <Input 
                  type="text" 
                  placeholder="Ask InternBot anything..." 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-500 h-10 shadow-none px-0"
                />
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping}
                  size="icon"
                  className="rounded-full shrink-0 h-9 w-9 bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_-3px_rgba(52,211,153,0.4)] hover:shadow-[0_0_20px_-3px_rgba(52,211,153,0.6)] transition-all disabled:opacity-40 disabled:shadow-none"
                >
                  <Send size={16} />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </GradientBarsBackground>
  );
}
