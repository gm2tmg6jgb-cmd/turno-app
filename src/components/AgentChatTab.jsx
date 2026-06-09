import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './AgentChatTab.css';

const AgentChatTab = ({ globalDate, turnoCorrente }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendQuery = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      // Use public function (no auth required) for better reliability
      const response = await fetch(`${supabaseUrl}/functions/v1/agent-ask-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          context: { globalDate, turnoCorrente }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Errore nella richiesta');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        role: 'assistant',
        content: `⚠️ Errore: ${err.message}`,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    'Quali conflitti di scheduling ci sono oggi?',
    'Quanti operatori del Team 11 sono disponibili domani?',
    'Suggerisci ottimizzazioni per questa settimana',
    'Quanto tempo per cambio da SG2 a SG3?',
    'Analizza utilizzo della linea 8Fe'
  ];

  return (
    <div className="agent-chat-tab">
      <div className="agent-header">
        <h2>🤖 Agente di Scheduling</h2>
        <p>Chiedimi tutto su turni, conflitti, ottimizzazioni e produzione</p>
      </div>

      <div className="agent-chat-container">
        <div className="messages-list">
          {messages.length === 0 && (
            <div className="empty-state">
              <h3>Ciao! Sono l'agente di scheduling di TurnoApp</h3>
              <p>Posso aiutarti con:</p>
              <ul>
                <li>Analizzare conflitti di scheduling</li>
                <li>Controllare disponibilità operatori</li>
                <li>Calcolare tempi di changeover</li>
                <li>Suggerire ottimizzazioni</li>
                <li>Analizzare efficienza delle linee</li>
              </ul>
              <div className="suggested-queries">
                <p style={{ marginBottom: '10px', fontWeight: '500' }}>Domande suggerite:</p>
                {suggestedQueries.map((q, idx) => (
                  <button
                    key={idx}
                    className="suggested-query-btn"
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => {
                        document.querySelector('.input-form')?.dispatchEvent(new Event('submit', { bubbles: true }));
                      }, 100);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}>
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="message-content">
                <p>{msg.content}</p>
                <small className="message-time">{msg.timestamp?.toLocaleTimeString('it-IT')}</small>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant loading">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="input-form" onSubmit={sendQuery}>
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Chiedimi di turni, conflitti, ottimizzazioni..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} className="send-btn">
              {loading ? '⏳' : '➤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentChatTab;
