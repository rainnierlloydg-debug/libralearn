import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import api from '../../utils/api';

const suggestedQuestions = [
  'Paano ako magre-reserve ng libro?',
  'Paano maghanap ng libro sa catalog?',
];

function StudentAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Kumusta! Maaari akong tumulong tungkol sa mga libro, library, at paggamit ng LibraLearn.' },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const sendMessage = async (content) => {
    const text = content.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');
    setLoading(true);

    try {
      const response = await api.post('/assistant/chat', {
        messages: nextMessages.slice(-12),
      });
      setMessages((current) => [...current, { role: 'assistant', content: response.data.reply }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error.response?.data?.message || 'Hindi ako makasagot ngayon. Subukan ulit mamaya.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 sm:right-6">
      {open && (
        <section
          className="mb-3 flex h-[min(36rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          aria-label="LibraLearn library assistant"
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[var(--text)]">Library Assistant</h2>
                <p className="text-xs text-[var(--text-muted)]">LibraLearn</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className={`max-w-[88%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-5 ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-teal-700 text-white'
                      : 'rounded-bl-sm bg-[var(--surface-2)] text-[var(--text)]'
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {messages.length === 1 && !loading && (
              <div className="space-y-2 pt-1">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="block max-w-full rounded-full border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-muted)] hover:border-teal-600 hover:text-teal-800"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Naghahanap ng sagot...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Itanong ang tungkol sa library o libro..."
                className="max-h-24 min-h-10 flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-teal-600"
                aria-label="Your question"
              />
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send question"
                title="Send question"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-[var(--text-faint)]">
              AI-generated answers may be inaccurate. Huwag magbahagi ng password o sensitibong impormasyon.
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        aria-label={open ? 'Close library assistant' : 'Open library assistant'}
        aria-expanded={open}
        title="Library assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}

export default StudentAssistant;
