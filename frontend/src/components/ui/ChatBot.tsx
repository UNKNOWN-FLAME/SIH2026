import React, { useState, useRef, useEffect } from 'react';
import { sendChatQuery } from '../../api/hq';
import { useAuth } from '../../hooks/useAuth';

// ── Custom Zero-Dependency Markdown Formatter ───────────────────────────────
// Completely eliminates raw ** or ` marks and renders clean styled React nodes
function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split('\n');

  const parseInline = (lineContent: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Matches **bold**, *italic*, or `code`
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    let cursor = 0;
    let match;

    while ((match = regex.exec(lineContent)) !== null) {
      if (match.index > cursor) {
        // Strip any dangling ** from pre-match text
        parts.push(lineContent.substring(cursor, match.index).replace(/\*\*/g, ''));
      }

      if (match[2] !== undefined) {
        // Bold
        parts.push(
          <strong key={`b-${match.index}`} className="font-semibold text-slate-900">
            {match[2].replace(/\*\*/g, '')}
          </strong>
        );
      } else if (match[3] !== undefined) {
        // Italic
        parts.push(
          <em key={`i-${match.index}`} className="italic text-slate-700">
            {match[3]}
          </em>
        );
      } else if (match[4] !== undefined) {
        // Code
        parts.push(
          <code key={`c-${match.index}`} className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11px]">
            {match[4]}
          </code>
        );
      }
      cursor = regex.lastIndex;
    }

    if (cursor < lineContent.length) {
      // Strip any stray ** in leftover text
      parts.push(lineContent.substring(cursor).replace(/\*\*/g, ''));
    }

    return parts;
  };

  return (
    <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed font-normal">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1" />;

        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const isNumbered = /^\d+\.\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : isNumbered ? trimmed.replace(/^\d+\.\s*/, '') : trimmed;

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
              <div className="flex-1">{parseInline(content)}</div>
            </div>
          );
        }

        if (isNumbered) {
          const numMatch = trimmed.match(/^(\d+\.)\s*/);
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-0.5">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0 w-3">{numMatch?.[1]}</span>
              <div className="flex-1">{parseInline(content)}</div>
            </div>
          );
        }

        return <div key={lineIdx}>{parseInline(trimmed)}</div>;
      })}
    </div>
  );
}

// ── Notion-Style Quick Action Prompts ─────────────────────────────────────────
const SUGGESTIONS = [
  { icon: 'bolt', label: 'Microgrid & Power status', prompt: 'What is the current power load and renewable generation across Maitri and Bharati?' },
  { icon: 'local_gas_station', label: 'Fuel reserves & autonomy', prompt: 'What is the fuel storage level, daily burn rate, and days of autonomy?' },
  { icon: 'cyclone', label: 'Blizzard risk & weather', prompt: 'What is the current weather, temperature, wind speed, and blizzard probability?' },
  { icon: 'warning', label: 'Active alarms & anomalies', prompt: 'Are there any active critical alerts, equipment anomalies, or faults?' },
];

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; time?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, time: timeStr }]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await sendChatQuery(trimmed);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: response.response, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: '• **Telemetry Link**: Failed to reach HQ copilot. Please verify network status.', time: timeStr },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(query);
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!token) return null;

  return (
    <div className="chatbot-container fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {isOpen && (
        <div
          className="mb-4 w-[380px] sm:w-[410px] h-[520px] bg-white border border-slate-200/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{ backdropFilter: 'blur(16px)' }}
        >
          {/* ── Top Header (Notion / Linear Clean Header) ── */}
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 tracking-tight">Himantar Copilot</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Antarctic SCADA • Maitri & Bharati</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear conversation"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={toggleChat}
                title="Close"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Chat Messages Body ── */}
          <div className="flex-1 px-4 py-3 overflow-y-auto bg-slate-50/60 space-y-3.5">
            {messages.length === 0 ? (
              /* Notion AI Style Welcome Screen */
              <div className="h-full flex flex-col justify-center py-3">
                <div className="w-11 h-11 rounded-full bg-white border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center text-slate-800 mb-3">
                  <svg className="w-5 h-5 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </div>
                <h3 className="text-[17px] font-semibold text-slate-900 tracking-tight">How can I help you today?</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-3.5 leading-normal">
                  Live polar SCADA copilot for Maitri & Bharati telemetry, fuel, microgrid & weather.
                </p>

                {/* Notion Style Quick Suggestions */}
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(s.prompt)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-slate-50/90 border border-slate-200/80 hover:border-slate-300 transition-all flex items-center gap-2.5 shadow-2xs group cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-slate-700 transition-colors">
                        {s.icon}
                      </span>
                      <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                        {s.label}
                      </span>
                      <span className="ml-auto material-symbols-outlined text-[13px] text-slate-300 group-hover:text-slate-500 transition-colors">
                        arrow_forward
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-slate-900 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 text-xs font-medium max-w-[82%] shadow-xs">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="group relative bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-3 max-w-[92%] shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Copilot</span>
                        <div className="flex items-center gap-1.5">
                          {msg.time && <span className="text-[9.5px] text-slate-400">{msg.time}</span>}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.content, idx)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 transition-opacity cursor-pointer"
                            title="Copy response"
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {copiedIdx === idx ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>
                      <FormattedMessageText text={msg.content} />
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Box (Notion AI Style Command Bar) ── */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100">
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask Himantar Copilot..."
                className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden px-1 py-1"
                disabled={isLoading}
              />
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100/90 text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live SCADA
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400">Maitri & Bharati</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 text-slate-500">Auto</span>
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="w-6 h-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:hover:bg-slate-900 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                    title="Send query"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Modern Floating Launcher Button ── */}
      <button
        onClick={toggleChat}
        className={`${
          isOpen
            ? 'bg-slate-800 scale-95 shadow-md'
            : 'bg-slate-900 hover:bg-slate-800 hover:scale-105 shadow-2xl'
        } text-white w-14 h-14 rounded-full transition-all duration-200 focus:outline-hidden ring-4 ring-slate-900/10 flex items-center justify-center group cursor-pointer`}
        aria-label="Toggle AI Copilot"
        title="Himantar AI Copilot"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="w-7 h-7 text-amber-300"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.45))' }}
          >
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        )}
      </button>
    </div>
  );
};
