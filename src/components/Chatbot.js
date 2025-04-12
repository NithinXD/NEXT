'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../lib/supabase';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I can help you book a spa service. What would you like to book today?'
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

    // Add user message to chat
    const userMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the FastAPI backend
      const response = await fetch('https://rag-l6ua.onrender.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.email || 'guest', // Use user's email as user_id if available
          message: userMessage.content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from chatbot');
      }

      const data = await response.json();
      
      // Add assistant response to chat
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
            content: `I'll help you book a ${services[0]} on ${dates[0]} at ${times[0]}. Taking you to the booking page...`
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
        content: 'Sorry, I encountered an error. Please try again later.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
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
        <div className="absolute bottom-16 right-0 w-96 bg-white rounded-lg shadow-xl overflow-hidden flex flex-col border border-gray-200" style={{ height: '50vh' }}>
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
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50" style={{ height: 'calc(50vh - 130px)' }}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-3">
                <div className="inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                  <div className="flex space-x-1">
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
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
            <div className="flex relative">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  className="flex-1 input-field pr-10"
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
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-md shadow-lg border border-gray-200 z-10">
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
                            onClick={() => handleSuggestionClick("How do I book a massage?")}
                            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-gray-700"
                          >
                            How do I book a massage?
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
                className="ml-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 disabled:opacity-50"
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