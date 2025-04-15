'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// This function fetches the memory documentation content from our API
const loadMemoryDocSections = async () => {
  try {
    console.log("Fetching memory documentation content from API...");
    const response = await fetch('/api/docs');
    
    if (!response.ok) {
      throw new Error(`Failed to load documentation: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.sections) {
      console.error("API response missing sections property:", data);
      throw new Error('API response missing sections property');
    }
    
    console.log("API returned sections:", data.sections.length);
    return data.sections;
  } catch (error) {
    console.error('Error loading memory documentation:', error);
    
    // As a fallback, return hardcoded sections
    console.log("Using fallback memory sections");
    
    return [
      {
        title: "Message Classification",
        content: "The first step in our process is to determine whether a user's message requires previous conversation context to be properly understood. We use Gemini to classify messages into context-dependent (messages that refer to previous conversations) and standalone (messages that can be answered without context)."
      },
      {
        title: "Adaptive Window Selection",
        content: "For context-dependent queries, we dynamically adjust the 'window' of conversation history based on the characteristics of the current message. Short follow-ups with pronouns get a smaller, more focused window, while messages with explicit references to previous conversations get a larger window."
      },
      {
        title: "Semantic Relevance Ranking",
        content: "Once we have our initial window, we rank the history items by their semantic relevance to the current query. This hybrid approach ensures that we select history items that are both semantically relevant to the current query and temporally relevant (with a preference for recent conversations)."
      },
      {
        title: "Pronoun Resolution",
        content: "A critical component of our system is accurate pronoun resolution, especially for follow-up questions. For short follow-up messages with pronouns, we prioritize the most recent conversation, identify the main topic, and map the pronoun to that topic."
      },
      {
        title: "Long-term Memory Retrieval",
        content: "Our system also maintains long-term memory of past conversations, allowing users to refer to topics discussed many messages ago. Even if a question comes after 20+ other messages or a new session, our system can recognize references to past conversations and provide contextually appropriate responses."
      }
    ];
  }
};

// This function loads the tools documentation from our API
const loadToolsDocSections = async () => {
  try {
    console.log("Fetching tools documentation content from API...");
    const response = await fetch('/api/tools');
    
    if (!response.ok) {
      throw new Error(`Failed to load tools documentation: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.sections) {
      console.error("API response missing sections property for tools:", data);
      throw new Error('API response missing sections property for tools');
    }
    
    console.log("API returned tools sections:", data.sections.length);
    return data.sections;
  } catch (error) {
    console.error('Error loading tools documentation:', error);
    return [];
  }
};

// This function loads the deployment documentation from our API
const loadDeploymentDocSections = async () => {
  try {
    console.log("Fetching deployment documentation content from API...");
    const response = await fetch('/api/deployment');
    
    if (!response.ok) {
      throw new Error(`Failed to load deployment documentation: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.sections) {
      console.error("API response missing sections property for deployment:", data);
      throw new Error('API response missing sections property for deployment');
    }
    
    console.log("API returned deployment sections:", data.sections.length);
    return data.sections;
  } catch (error) {
    console.error('Error loading deployment documentation:', error);
    return [];
  }
};

export default function DocsPage() {
  const [memorySections, setMemorySections] = useState([]);
  const [toolsSections, setToolsSections] = useState([]);
  const [deploymentSections, setDeploymentSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [deploymentExpanded, setDeploymentExpanded] = useState(false);
  const [expandedMemorySections, setExpandedMemorySections] = useState({});
  const [expandedToolsSections, setExpandedToolsSections] = useState({});
  const [expandedDeploymentSections, setExpandedDeploymentSections] = useState({});

  useEffect(() => {
    // Fetch all documentation sections when the component mounts
    const fetchAllSections = async () => {
      try {
        setLoading(true);
        
        // Fetch memory documentation
        const fetchedMemorySections = await loadMemoryDocSections();
        
        if (fetchedMemorySections && fetchedMemorySections.length > 0) {
          console.log("Loaded memory sections:", fetchedMemorySections.length);
          setMemorySections(fetchedMemorySections);
          
          // Initialize all memory sections as collapsed
          const initialMemoryExpandState = {};
          fetchedMemorySections.forEach((_, index) => {
            initialMemoryExpandState[index] = false;
          });
          setExpandedMemorySections(initialMemoryExpandState);
        } else {
          console.error('Failed to load memory documentation sections');
        }
        
        // Fetch tools documentation
        const fetchedToolsSections = await loadToolsDocSections();
        
        if (fetchedToolsSections && fetchedToolsSections.length > 0) {
          console.log("Loaded tools sections:", fetchedToolsSections.length);
          setToolsSections(fetchedToolsSections);
          
          // Initialize all tools sections as collapsed
          const initialToolsExpandState = {};
          fetchedToolsSections.forEach((_, index) => {
            initialToolsExpandState[index] = false;
          });
          setExpandedToolsSections(initialToolsExpandState);
        } else {
          console.error('Failed to load tools documentation sections');
        }

        // Fetch deployment documentation
        const fetchedDeploymentSections = await loadDeploymentDocSections();
        
        if (fetchedDeploymentSections && fetchedDeploymentSections.length > 0) {
          console.log("Loaded deployment sections:", fetchedDeploymentSections.length);
          setDeploymentSections(fetchedDeploymentSections);
          
          // Initialize all deployment sections as collapsed
          const initialDeploymentExpandState = {};
          fetchedDeploymentSections.forEach((_, index) => {
            initialDeploymentExpandState[index] = false;
          });
          setExpandedDeploymentSections(initialDeploymentExpandState);
        } else {
          console.error('Failed to load deployment documentation sections');
        }
      } catch (err) {
        console.error('Error in fetchAllSections:', err);
        setError('An error occurred while loading the documentation');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllSections();
  }, []);

  // Toggle the expansion state of a memory section
  const toggleMemorySection = (index) => {
    setExpandedMemorySections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Toggle the expansion state of a tools section
  const toggleToolsSection = (index) => {
    setExpandedToolsSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Toggle the expansion state of a deployment section
  const toggleDeploymentSection = (index) => {
    setExpandedDeploymentSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Toggle the memory section
  const toggleMemoryMainSection = () => {
    setMemoryExpanded(!memoryExpanded);
  };

  // Toggle the tools section
  const toggleToolsMainSection = () => {
    setToolsExpanded(!toolsExpanded);
  };

  // Toggle the deployment section
  const toggleDeploymentMainSection = () => {
    setDeploymentExpanded(!deploymentExpanded);
  };

  // Function to format code blocks with proper styling
  const formatContent = (content) => {
    if (!content) return '';
    
    console.log("Formatting content of length:", content.length);
    
    // For simple text content without markdown, just return it wrapped in a paragraph
    if (!content.includes('```') && !content.includes('**') && !content.includes('#')) {
      return `<p>${content}</p>`;
    }
    
    // Replace code blocks with styled pre elements
    const formattedContent = content.replace(
      /```([\s\S]*?)```/g,
      (match, codeContent) => {
        return `<pre class="bg-gray-100 p-4 rounded-md overflow-x-auto my-4 text-sm font-mono">${codeContent}</pre>`;
      }
    );

    // Replace mermaid code blocks
    const withMermaid = formattedContent.replace(
      /```mermaid([\s\S]*?)```/g,
      (match, codeContent) => {
        return `<div class="bg-blue-50 p-4 rounded-md my-4 border-l-4 border-blue-500">
          <p class="font-semibold text-blue-700 mb-2">Flow Diagram</p>
          <pre class="text-sm font-mono">${codeContent}</pre>
        </div>`;
      }
    );


    const withPython = withMermaid.replace(
      /```python([\s\S]*?)```/g,
      (match, codeContent) => {
        return `<pre class="bg-gray-100 p-4 rounded-md overflow-x-auto my-4 text-sm font-mono">${codeContent}</pre>`;
      }
    );

    // python styled blocks
    const withPythonFunctions = withPython.replace(
      /def\s+(.*?)(?=\n\n|\n\d+\.|\n$)/gs,
      (match) => {
        return `<pre class="bg-gray-100 p-4 rounded-md overflow-x-auto my-4 text-sm font-mono">${match}</pre>`;
      }
    );

    // graph styled blocks
    const withGraphs = withPythonFunctions.replace(
      /graph TD[\s\S]*?(?=\n\n|\n\d+\.|\n$)/g,
      (match) => {
        return `<div class="bg-blue-50 p-4 rounded-md my-4 border-l-4 border-blue-500">
          <p class="font-semibold text-blue-700 mb-2">Flow Diagram</p>
          <pre class="text-sm font-mono">${match}</pre>
        </div>`;
      }
    );

    const withExamples = withGraphs.replace(
      /\*\*Example:\*\*([\s\S]*?)(?=\n\n\w|\n\*\*|\n$)/g,
      (match, exampleContent) => {
        return `<div class="bg-green-50 p-4 rounded-md my-4 border-l-4 border-green-500">
          <p class="font-semibold text-green-700 mb-2">Example</p>
          <div>${exampleContent}</div>
        </div>`;
      }
    );

    // Format bullet points
    const withBulletPoints = withExamples.replace(
      /^\*\s+(.*?)$/gm,
      (match, bulletContent) => {
        return `<li class="ml-6 mb-2">• ${bulletContent}</li>`;
      }
    );

    // Format numbered lists
    const withNumberedLists = withBulletPoints.replace(
      /^\d+\.\s+(.*?)$/gm,
      (match, listContent) => {
        return `<li class="ml-6 mb-2 list-decimal">${listContent}</li>`;
      }
    );

    // Format conversation examples
    const withConversations = withNumberedLists.replace(
      />\s+\*\*User:\*\*(.*?)\n>\s+\*\*Bot:\*\*([\s\S]*?)(?=\n\n|>\s+\[|\>\s+\*\*User:|$)/g,
      (match, userMsg, botMsg) => {
        return `<div class="bg-gray-50 p-4 rounded-md my-4 border border-gray-200">
          <div class="mb-2"><span class="font-semibold text-blue-600">User:</span>${userMsg}</div>
          <div class="mb-2"><span class="font-semibold text-purple-600">Bot:</span>${botMsg}</div>
        </div>`;
      }
    );
    
    // Format time passage indicators in conversations
    const withTimePassage = withConversations.replace(
      />\s+\[(.*?)\]/g,
      (match, timeText) => {
        return `<div class="text-center my-3 text-gray-500 italic">[${timeText}]</div>`;
      }
    );
    
    // Format single user examples
    const withSingleUserExamples = withTimePassage.replace(
      />\s+\*\*User:\*\*(.*?)(?=\n\n|$)/g,
      (match, userMsg) => {
        return `<div class="bg-gray-50 p-4 rounded-md my-4 border border-gray-200">
          <div class="mb-2"><span class="font-semibold text-blue-600">User:</span>${userMsg}</div>
        </div>`;
      }
    );
    
    // Format subsection headers (### Example 1:, etc.)
    const withSubsections = withSingleUserExamples.replace(
      /###\s+(.*?)$/gm,
      (match, subsectionTitle) => {
        return `<h4 class="text-lg font-semibold text-indigo-700 mt-6 mb-3 border-b pb-1">${subsectionTitle}</h4>`;
      }
    );

    // Format bold text
    const withBoldText = withSubsections.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convert newlines to <br> tags and handle paragraphs
    return withBoldText.replace(/\n\n/g, '</p><p class="my-4">').replace(/\n(?!\<\/p\>)/g, '<br>');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Purple-blue bar with white text */}
      <header className="bg-[#4D66F8] py-5 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-white text-center text-2xl font-bold">
            Service Business Customer Support Chatbot
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* White card container */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : error ? (
              <div className="text-red-500">
                Error loading documentation. Please try again later.
              </div>
            ) : (
              <div className="space-y-8">
                {/* Memory section */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Memory section header */}
                  <button 
                    onClick={toggleMemoryMainSection}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <h2 className="text-xl font-bold text-gray-800">
                      How Our Chatbot Uses Memory for Context
                    </h2>
                    <svg 
                      className={`h-6 w-6 text-gray-500 transform transition-transform ${memoryExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Memory section content */}
                  {memoryExpanded && (
                    <div className="p-4">
                      {/* Memory subsections */}
                      <div className="space-y-4">
                        {memorySections && memorySections.length > 0 ? (
                          memorySections.map((section, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                              {/* Memory subsection header */}
                              <button 
                                onClick={() => toggleMemorySection(index)}
                                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              >
                                <h3 className="text-lg font-semibold text-gray-800">
                                  {index + 1}. {section.title}
                                </h3>
                                <svg 
                                  className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedMemorySections[index] ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {/* Memory subsection content */}
                              {expandedMemorySections[index] && (
                                <div className="p-4 border-t border-gray-200">
                                  {section.content ? (
                                    <div 
                                      className="text-gray-700 leading-relaxed prose max-w-none max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                                      dangerouslySetInnerHTML={{ 
                                        __html: `<div class="my-4">${formatContent(section.content)}</div>` 
                                      }}
                                    />
                                  ) : (
                                    <p className="text-red-500">No content available for this section</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-red-500">No memory sections found. Please check the API response.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tools section */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Tools section header */}
                  <button 
                    onClick={toggleToolsMainSection}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <h2 className="text-xl font-bold text-gray-800">
                      Tools Used by The Bot
                    </h2>
                    <svg 
                      className={`h-6 w-6 text-gray-500 transform transition-transform ${toolsExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Tools section content */}
                  {toolsExpanded && (
                    <div className="p-4">
                      {/* Tools subsections */}
                      <div className="space-y-4">
                        {toolsSections && toolsSections.length > 0 ? (
                          toolsSections.map((section, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                              {/* Tools subsection header */}
                              <button 
                                onClick={() => toggleToolsSection(index)}
                                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              >
                                <h3 className="text-lg font-semibold text-gray-800">
                                  {section.title}
                                </h3>
                                <svg 
                                  className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedToolsSections[index] ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {/* Tools subsection content */}
                              {expandedToolsSections[index] && (
                                <div className="p-4 border-t border-gray-200">
                                  {section.content ? (
                                    <div 
                                      className="text-gray-700 leading-relaxed prose max-w-none max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                                      dangerouslySetInnerHTML={{ 
                                        __html: `<div class="my-4">${formatContent(section.content)}</div>` 
                                      }}
                                    />
                                  ) : (
                                    <p className="text-red-500">No content available for this section</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-red-500">No tools sections found. Please check the tools documentation file.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deployment section */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Deployment section header */}
                  <button 
                    onClick={toggleDeploymentMainSection}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <h2 className="text-xl font-bold text-gray-800">
                      Deployment Architecture
                    </h2>
                    <svg 
                      className={`h-6 w-6 text-gray-500 transform transition-transform ${deploymentExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Deployment section content */}
                  {deploymentExpanded && (
                    <div className="p-4">
                      {/* Deployment subsections */}
                      <div className="space-y-4">
                        {deploymentSections && deploymentSections.length > 0 ? (
                          deploymentSections.map((section, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                              {/* Deployment subsection header */}
                              <button 
                                onClick={() => toggleDeploymentSection(index)}
                                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              >
                                <h3 className="text-lg font-semibold text-gray-800">
                                  {section.title}
                                </h3>
                                <svg 
                                  className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedDeploymentSections[index] ? 'rotate-180' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {/* Deployment subsection content */}
                              {expandedDeploymentSections[index] && (
                                <div className="p-4 border-t border-gray-200">
                                  {section.content ? (
                                    <div 
                                      className="text-gray-700 leading-relaxed prose max-w-none max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                                      dangerouslySetInnerHTML={{ 
                                        __html: `<div class="my-4">${formatContent(section.content)}</div>` 
                                      }}
                                    />
                                  ) : (
                                    <p className="text-red-500">No content available for this section</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-red-500">No deployment sections found. Please check the deployment documentation file.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer with link back to contact */}
      <footer className="bg-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 mb-4 md:mb-0">
              © {new Date().getFullYear()} Service Business Customer Support
            </p>
            <div className="flex space-x-6">
              <Link href="/contact" className="text-blue-600 hover:text-blue-800">
                Contact Us
              </Link>
              <Link href="/docs" className="text-blue-600 hover:text-blue-800 font-semibold">
                Docs
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}