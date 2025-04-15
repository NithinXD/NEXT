'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import supabase from '../lib/supabase';

// Helper function to escape HTML
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function Chatbot() {
  // CSS for markdown content
  const markdownStyles = `
    .markdown-content {
      font-size: inherit;
      line-height: 1.5;
    }
    .markdown-content p:last-child {
      margin-bottom: 0;
    }
    .markdown-content pre {
      white-space: pre-wrap;
      word-break: break-word;
      background-color: rgba(0, 0, 0, 0.05);
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin: 0.5rem 0;
    }
    .markdown-content blockquote {
      border-left: 3px solid #cbd5e0;
      padding-left: 1rem;
      margin: 0.5rem 0;
      color: #4a5568;
    }
    .markdown-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.5rem 0;
    }
    .markdown-content th, .markdown-content td {
      border: 1px solid #e2e8f0;
      padding: 0.25rem 0.5rem;
      text-align: left;
    }
    .markdown-content th {
      background-color: #f7fafc;
    }
  `;
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 **Hello!** I can help you book a spa service. What would you like to book today?\n\nYou can ask me about:\n- Available services\n- Pricing\n- Booking appointments'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();

  // Get user session on component mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    getUser();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setShowSuggestions(false); // Hide suggestions when toggling chat
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputValue.trim()) return;
    
    // Ensure user is logged in
    if (!user) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '**Authentication Required:** You need to be logged in to use the chatbot. Please [sign in](/login) or create an account.'
      }]);
      return;
    }

    // Add user message to chat
    const userMessage = { role: 'user', content: escapeHtml(inputValue) };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the FastAPI backend
      // const response = await fetch('http://localhost:5432/api/chat', {
      const response = await fetch('https://rag-l6ua.onrender.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.email, // Use user's email as user_id
          message: userMessage.content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from chatbot');
      }

      const data = await response.json();
      
      // Add assistant response to chat
      // We don't escape the response content as it will be rendered as markdown
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        intents: data.intents,
        entities: data.entities
      }]);
      
      // Handle booking intent if detected
      if (data.intents && data.intents.includes('booking')) {
        const entities = data.entities || {};
        const services = entities.services || [];
        const dates = entities.dates || [];
        const times = entities.times || [];
        
        // If we have all the necessary information for a booking
        if (services.length > 0 && dates.length > 0 && times.length > 0) {
          // Add a message about redirecting
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `I'll help you book a **${services[0]}** on **${dates[0]}** at **${times[0]}**. Taking you to the booking page...`
          }]);
          
          // Wait a moment before redirecting
          setTimeout(() => {
            // Find the service ID based on name (this would need to be implemented)
            // For now, just redirect to booking page
            router.push('/booking');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error communicating with chatbot:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '**Error:** Sorry, I encountered an error. Please try again later.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // If no user is logged in, show a login prompt instead of the chatbot
  if (!user) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
        <button
          onClick={toggleChat}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
          aria-label="Login to use chat"
          title="Login to use chat"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </button>
        
        {/* Login prompt tooltip */}
        {isOpen && (
          <div className="fixed md:absolute bottom-0 md:bottom-16 right-0 w-full md:w-64 max-w-full bg-white rounded-t-lg md:rounded-lg shadow-lg p-4 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800">Chat Assistant</h3>
              <button
                onClick={toggleChat}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-3">Please sign in to use our chat assistant.</p>
            <div className="flex justify-end">
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Sign in
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      {/* Chat toggle button */}
      <button
        onClick={toggleChat}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed md:absolute bottom-0 md:bottom-16 right-0 w-full md:w-96 max-w-full md:max-w-md bg-white rounded-t-lg md:rounded-lg shadow-xl overflow-hidden flex flex-col border border-gray-200 h-[70vh] md:h-[50vh]">
          {/* Chat header */}
          <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-semibold">Spa Assistant</h3>
            <button
              onClick={toggleChat}
              className="text-white hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-lg max-w-[85%] break-words ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown
                        components={{
                          // Customize how specific markdown elements are rendered
                          p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                          a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                          code: ({ node, inline, ...props }) => 
                            inline 
                              ? <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />
                              : <code className="block bg-gray-100 p-2 rounded text-sm overflow-x-auto my-2" {...props} />
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-3">
                <div className="inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                  <div className="flex space-x-1 items-center">
                    <span className="text-xs text-gray-600 mr-2">Thinking</span>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 bg-white">
            <div className="flex relative">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  className="flex-1 input-field pr-10 w-full"
                  disabled={isLoading}
                />
                {/* Help button (dot) */}
                <button
                  type="button"
                  onClick={toggleSuggestions}
                  className="absolute right-3 w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  title="Suggestions"
                >
                  <span className="sr-only">Suggestions</span>
                </button>

                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-md shadow-lg border border-gray-200 z-10 max-h-[40vh] overflow-y-auto">
                    <div className="p-2">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Suggested questions:</h4>
                      <ul className="space-y-1">
                        <li>
                          <button
                            type="button"
                            onClick={() => handleSuggestionClick("What services do you offer?")}
                            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-gray-700"
                          >
                            What services do you offer?
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => handleSuggestionClick("What upcoming appointments do I have?")}
                            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-gray-700"
                          >
                            What upcoming appointments do I have?
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => handleSuggestionClick("Make a Booking for <service> on <date>, <time>")}
                            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-gray-700"
                          >
                            Make a Booking for service on date, time
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="ml-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 disabled:opacity-50 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}