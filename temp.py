import os
import uuid
import time
import json
import logging
import requests
import google.generativeai as genai
import numpy as np
from mem.emb import get_embedding, cosine_similarity
from mem.pine_client import index
from dotenv import load_dotenv
from datetime import datetime, timedelta
import threading
import re
import agno
from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.sql import SQLTools
import psycopg2
from psycopg2 import sql
from textwrap import dedent

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

# Get all available Gemini API keys
def get_gemini_api_keys():
    keys = []
    # Get the primary key
    primary_key = os.getenv("GEMINI_API_KEY")
    if primary_key:
        keys.append(primary_key)

    # Get additional keys that might be in the .env file
    for i in range(1, 10):  # Check for up to 10 additional keys
        key = os.getenv(f"GEMINI_API_KEY_{i}")
        if key:
            keys.append(key)

    # Get the Google API key as a fallback
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if google_api_key and google_api_key not in keys:
        keys.append(google_api_key)

    # Check for keys that might be directly in the .env file without a variable name
    try:
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                # Look for lines that contain just an API key (starts with AIza)
                if line.startswith("AIza") and len(line) > 30 and "=" not in line:
                    if line not in keys:
                        keys.append(line)
                # Also check for keys in format GOOGLE_API_KEY=AIza...
                elif "=" in line and "API_KEY" in line:
                    parts = line.split("=", 1)
                    if len(parts) == 2 and parts[1].startswith("AIza") and len(parts[1]) > 30:
                        key = parts[1].strip()
                        if key not in keys:
                            keys.append(key)
    except Exception as e:
        logger.error(f"Error reading .env file: {str(e)}")

    logger.info(f"Found {len(keys)} Gemini API keys")
    return keys

# Get Grok API key
def get_grok_api_key():
    grok_key = os.getenv("GROK_API_KEY")
    if grok_key:
        logger.info("Grok API key found")
        return grok_key
    else:
        logger.warning("No Grok API key found")
        return None

# Call Grok API
def generate_with_grok(prompt):
    """
    Generate content using Grok API

    Args:
        prompt (str): The prompt to send to Grok

    Returns:
        str: The generated text response

    Raises:
        Exception: If the API call fails
    """
    grok_key = get_grok_api_key()
    if not grok_key:
        raise Exception("No Grok API key available")

    headers = {
        "Authorization": f"Bearer {grok_key}",
        "Content-Type": "application/json"
    }

    data = {
        "prompt": prompt,
        "max_tokens": 4096,
        "temperature": 0.7
    }

    try:
        response = requests.post(
            "https://api.xai.com/v1/completions",
            headers=headers,
            json=data
        )

        if response.status_code == 200:
            result = response.json()
            return result.get("choices", [{}])[0].get("text", "")
        else:
            logger.error(f"Grok API error: {response.status_code} - {response.text}")
            raise Exception(f"Grok API error: {response.status_code}")
    except Exception as e:
        logger.error(f"Error calling Grok API: {str(e)}")
        raise

# Initialize Gemini model with key rotation and model fallback
gemini_api_keys = get_gemini_api_keys()
current_key_index = 0
current_model_index = 0

# List of available Gemini models to try in order of preference
GEMINI_MODELS = [
    "gemini-1.5-pro-002",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
]

def get_gemini_model(model_name=None):
    global current_key_index, current_model_index, gemini_api_keys

    # If we've tried all keys, start over
    if current_key_index >= len(gemini_api_keys):
        current_key_index = 0
        # Move to the next model when we've exhausted all keys
        current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
        logger.warning(f"All Gemini API keys have been tried. Moving to model: {GEMINI_MODELS[current_model_index]}")

    # Get the current key
    api_key = gemini_api_keys[current_key_index]
    logger.info(f"Using Gemini API key at index {current_key_index}")

    # Configure the genai client
    genai.configure(api_key=api_key)

    # Use specified model or current model from fallback sequence
    model_to_use = model_name if model_name else GEMINI_MODELS[current_model_index]
    logger.info(f"Using Gemini model: {model_to_use}")

    # Create and return the model
    return genai.GenerativeModel(model_to_use)

# Function to rotate to the next key when one fails
def rotate_gemini_key():
    global current_key_index

    # Move to the next key
    current_key_index += 1
    logger.info(f"Rotating to next Gemini API key (index: {current_key_index})")

    # Get a new model with the next key
    return get_gemini_model()

# Function to try the next model in the fallback sequence
def try_next_model():
    global current_model_index

    # Move to the next model
    current_model_index = (current_model_index + 1) % len(GEMINI_MODELS)
    logger.info(f"Switching to next Gemini model: {GEMINI_MODELS[current_model_index]}")

    # Get a model with the current key but next model in sequence
    return get_gemini_model()

# Generate content with fallback
def generate_content(prompt):
    """
    Generate content using Grok first, then fall back to Gemini if Grok fails

    Args:
        prompt (str): The prompt to send to the model

    Returns:
        str: The generated text response
    """
    # Check if Grok API key is available
    grok_api_key = get_grok_api_key()
    if not grok_api_key:
        logger.warning("No Grok API key available, using Gemini for content generation")
    else:
        # Try Grok first
        try:
            logger.info("Attempting to generate content with Grok")
            response_text = generate_with_grok(prompt)
            if response_text:
                logger.info("Successfully generated content with Grok")
                return response_text
            else:
                logger.warning("Grok returned empty response, falling back to Gemini")
        except requests.exceptions.RequestException as req_error:
            # Network or API-specific errors
            logger.warning(f"Grok API request failed, falling back to Gemini: {str(req_error)}")
        except Exception as e:
            # Other unexpected errors
            logger.warning(f"Grok generation failed with unexpected error, falling back to Gemini: {str(e)}")

    # Fall back to Gemini with key rotation and model fallback
    logger.info("Using Gemini for content generation")
    max_key_retries = min(3, len(gemini_api_keys))
    max_model_retries = min(3, len(GEMINI_MODELS))

    # Try different models
    for model_retry in range(max_model_retries):
        # Try different API keys for each model
        for key_retry in range(max_key_retries):
            try:
                # Get a fresh model instance for each attempt
                if model_retry == 0 and key_retry == 0 and model is not None:
                    current_model = model
                else:
                    current_model = get_gemini_model()

                # Try to generate content
                response = current_model.generate_content(prompt)
                response_text = response.text
                logger.info(f"Successfully generated content with Gemini model {GEMINI_MODELS[current_model_index]}")
                return response_text
            except Exception as gemini_error:
                logger.error(f"Error generating content with Gemini model {GEMINI_MODELS[current_model_index]} (model attempt {model_retry+1}/{max_model_retries}, key attempt {key_retry+1}/{max_key_retries}): {str(gemini_error)}")

                if key_retry < max_key_retries - 1:
                    # Rotate to the next key and try again with the same model
                    rotate_gemini_key()
                    logger.info(f"Retrying with next Gemini API key")
                elif model_retry < max_model_retries - 1:
                    # Try the next model in the sequence
                    try_next_model()
                    logger.info(f"Retrying with next Gemini model: {GEMINI_MODELS[current_model_index]}")
                    # Break out of the key retry loop to start with the new model
                    break

    # All retries failed, return a fallback response
    return "I'm sorry, but I'm having trouble generating a response right now. Please try again later."

# Configure API clients
try:
    model = get_gemini_model()
except Exception as e:
    logger.error(f"Error initializing Gemini model: {str(e)}")
    # Create a dummy model that will be replaced on first use
    model = None

serper_api_key = os.getenv("SERPER_API_KEY")
jina_api_key = os.getenv("JINA_API_KEY")
grok_api_key = os.getenv("GROK_API_KEY")

# Initialize Agno agent with Gemini model fallback
def get_agno_agent(instructions=None, tools=None):
    """
    Create an Agno agent with Gemini model (with fallback support)

    Args:
        instructions (str): Custom instructions for the agent
        tools (list): List of Agno tools to use with the agent

    Returns:
        Agent: Configured Agno agent
    """
    default_instructions = dedent("""
        You are a helpful assistant for Tranquility Spa & Wellness Center.
        Provide accurate and helpful information about spa services, bookings, and policies.
        Be friendly, professional, and concise in your responses.
    """)

    # Get the current API key
    global current_key_index, current_model_index, gemini_api_keys
    api_key = gemini_api_keys[current_key_index]
    model_id = GEMINI_MODELS[current_model_index]

    # Create the agent with the current Gemini model
    logger.info(f"Creating Agno agent with Gemini model: {model_id}")
    agent = Agent(
        model=Gemini(id=model_id, api_key=api_key),
        instructions=instructions or default_instructions,
        tools=tools or []
    )

    return agent

# Get Agno agent with key rotation and model fallback on failure
def get_agno_agent_with_retry(instructions=None, tools=None):
    """
    Create an Agno agent with Gemini model, with key rotation and model fallback on failure

    Args:
        instructions (str): Custom instructions for the agent
        tools (list): List of Agno tools to use with the agent

    Returns:
        Agent: Configured Agno agent
    """
    global current_key_index, current_model_index, gemini_api_keys

    # First check if Grok is available - if not, we'll use Gemini
    grok_api_key = get_grok_api_key()
    if not grok_api_key:
        logger.warning("No Grok API key available, using Gemini for Agno agent")
    else:
        # Log that we're using Gemini even though Grok is available
        # This is because Agno doesn't directly support Grok as a model
        logger.info("Grok API key is available, but using Gemini for Agno agent as Agno doesn't support Grok directly")
        # Note: For direct text generation (not using Agno), we'll still use Grok first via generate_content()

    max_key_retries = min(3, len(gemini_api_keys))
    max_model_retries = min(3, len(GEMINI_MODELS))
    last_error = None

    # Try different models
    for model_retry in range(max_model_retries):
        # Try different API keys for each model
        for key_retry in range(max_key_retries):
            try:
                # Create the agent with the current key and model
                agent = get_agno_agent(instructions, tools)

                # Log which model and key we're using
                logger.info(f"Successfully created Agno agent with model {GEMINI_MODELS[current_model_index]} and key index {current_key_index}")

                # Don't test the agent - it might use up quota unnecessarily
                # Just return it and let it be used when needed
                return agent
            except Exception as e:
                last_error = e
                logger.error(f"Error creating Agno agent with model {GEMINI_MODELS[current_model_index]} (model attempt {model_retry+1}/{max_model_retries}, key attempt {key_retry+1}/{max_key_retries}): {str(e)}")

                if key_retry < max_key_retries - 1:
                    # Rotate to the next key and try again with the same model
                    rotate_gemini_key()
                    logger.info(f"Retrying with next Gemini API key")
                elif model_retry < max_model_retries - 1:
                    # Try the next model in the sequence
                    try_next_model()
                    logger.info(f"Retrying with next Gemini model: {GEMINI_MODELS[current_model_index]}")
                    # Break out of the key retry loop to start with the new model
                    break

    # If we get here, all retries failed
    logger.error(f"All attempts to create Agno agent failed: {str(last_error)}")
    raise last_error
# Spa service business information
SPA_BUSINESS = {
    "name": "Tranquility Spa & Wellness Center",
    "description": "A premium spa offering massage therapy, facials, body treatments, and wellness services.",
    "hours": {
        "Monday": "9:00 AM - 8:00 PM",
        "Tuesday": "9:00 AM - 8:00 PM",
        "Wednesday": "9:00 AM - 8:00 PM",
        "Thursday": "9:00 AM - 8:00 PM",
        "Friday": "9:00 AM - 9:00 PM",
        "Saturday": "8:00 AM - 9:00 PM",
        "Sunday": "10:00 AM - 6:00 PM"
    },
    "services": [],
    "booking_policy": "Appointments must be booked at least 4 hours in advance. We recommend booking 2-3 days ahead for weekend appointments.",
    "cancellation_policy": "Cancellations must be made at least 24 hours before your appointment to avoid a 50% cancellation fee. No-shows will be charged the full service amount.",
    "contact": {
        "phone": "(555) 123-4567",
        "email": "appointments@tranquilityspa.com",
        "website": "www.tranquilityspa.com",
        "address": "123 Serenity Lane, Relaxville, CA 94123"
    }
}


# Database connection
def get_db_connection():
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")

    # Connect to the database
    try:
        connection = psycopg2.connect(
            user=USER,
            password=PASSWORD,
            host=HOST,
            port=PORT,
            dbname=DBNAME
        )
        #print("Connection successful!")

        # Create a cursor to execute SQL queries
        cursor = connection.cursor()

        # Example query
        cursor.execute("SELECT * FROM public.services;")
        result = cursor.fetchall()
        return connection
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

# Get services from database
def get_services_from_db():

    try:
        USER = os.getenv("user")
        PASSWORD = os.getenv("password")
        HOST = os.getenv("host")
        PORT = os.getenv("port")
        DBNAME = os.getenv("dbname")

        connection = psycopg2.connect(
            user=USER,
            password=PASSWORD,
            host=HOST,
            port=PORT,
            dbname=DBNAME
        )
        #print("Connection successful!")

        # Create a cursor to execute SQL queries
        cursor = connection.cursor()

        # Use the exact column names from the schema
        query = """
        SELECT "Service ID", "Service Name", "Description", "Price (INR)", "Category"
        FROM public.services;
        """

        cursor.execute(query)
        services = cursor.fetchall()

        result = []
        for service in services:
            result.append({
                "id": service[0] if service[0] is not None else "",
                "name": str(service[1]) if service[1] is not None else "",
                "description": str(service[2]) if service[2] is not None else "",
                "price": service[3] if service[3] is not None else "",
                "category": str(service[4]) if service[4] is not None else ""
            })

        cursor.close()
        connection.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching services: {str(e)}")
        if connection:
            connection.close()
        return []

# Available time slots from database
def get_available_time_slots(days_ahead=7, service_name=None):
    connection = get_db_connection()
    if not connection:
        return {}

    available_slots = {}
    today = datetime.now()
    current_time = today.strftime("%H:%M:%S")
    current_date = today.strftime("%Y-%m-%d")

    try:
        cursor = connection.cursor()

        # Check if bookings table exists
        cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings' AND table_schema = 'public');")
        table_exists = cursor.fetchone()[0]

        if not table_exists:
            logger.warning("Bookings table does not exist")
            connection.close()
            return {}

        for i in range(days_ahead):
            date = today + timedelta(days=i)
            day_name = date.strftime("%A")
            date_str = date.strftime("%Y-%m-%d")

            # Skip if business is closed that day
            if day_name not in SPA_BUSINESS["hours"]:
                continue

            # Parse business hours
            hours = SPA_BUSINESS["hours"][day_name]
            start_time, end_time = hours.split(" - ")

            # Convert to datetime objects
            start_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %I:%M %p")
            end_dt = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %I:%M %p")

            # Query to get booked slots for this date
            if service_name:
                # First get the service ID for the service name
                service_id_query = """
                SELECT "Service ID" FROM public.services
                WHERE "Service Name" = %s
                """
                cursor.execute(service_id_query, (service_name,))
                service_id_result = cursor.fetchone()

                if service_id_result:
                    service_id = service_id_result[0]
                    query = """
                    SELECT "Time Slot (HH:MM)" FROM public.bookings
                    WHERE "Booking Date" = %s AND "Service ID" = %s
                    """
                    cursor.execute(query, (date_str, service_id))
                else:
                    # Service not found, return empty slots
                    logger.warning(f"Service not found: {service_name}")
                    query = """
                    SELECT "Time Slot (HH:MM)" FROM public.bookings
                    WHERE "Booking Date" = %s
                    """
                    cursor.execute(query, (date_str,))
            else:
                query = """
                SELECT "Time Slot (HH:MM)" FROM public.bookings
                WHERE "Booking Date" = %s
                """
                cursor.execute(query, (date_str,))

            booked_slots = [row[0] for row in cursor.fetchall()]

            # Generate time slots every 30 minutes
            slots = []
            current = start_dt
            while current < end_dt:
                time_slot = current.strftime("%I:%M %p")

                # Check if slot is already booked
                if time_slot not in booked_slots:
                    # For today, only show future slots (4+ hours ahead)
                    if date_str == current_date:
                        slot_time = datetime.strptime(time_slot, "%I:%M %p")
                        current_time_dt = datetime.strptime(current_time, "%H:%M:%S")

                        # Check if slot is at least 4 hours ahead (booking policy)
                        time_diff = (slot_time.hour - current_time_dt.hour) * 60 + (slot_time.minute - current_time_dt.minute)
                        if time_diff >= 240:  # 4 hours = 240 minutes
                            slots.append(time_slot)
                    else:
                        slots.append(time_slot)

                current += timedelta(minutes=30)

            if slots:
                available_slots[date_str] = slots

        cursor.close()
        connection.close()
        return available_slots
    except Exception as e:
        logger.error(f"Error fetching available slots: {str(e)}")
        if connection:
            connection.close()
        return {}

# Memory types
MEMORY_TYPES = {
    "INTERACTION": "interaction",           # Regular conversation
    "FAQ": "faq",                           # Frequently asked questions
    "BOOKING": "booking",                   # Booking information
    "PREFERENCE": "preference",             # User preferences
    "SERVICE_INTEREST": "service_interest"  # Services the user has shown interest in
}

# Store memory with classification
def store_memory(user_id, message, response, memory_type=MEMORY_TYPES["INTERACTION"], additional_metadata=None):
    # Ensure response is not None
    if response is None:
        response = "No response generated"

    combined = f"User: {message}\nBot: {response}"
    vector = get_embedding(combined)
    timestamp = int(time.time())
    memory_id = f"{user_id}-{uuid.uuid4()}"

    metadata = {
        "user_id": user_id,
        "message": message,
        "response": response,
        "timestamp": timestamp,
        "type": memory_type
    }

    # Add any additional metadata
    if additional_metadata:
        # Ensure all metadata values are valid types for Pinecone
        sanitized_metadata = {}
        for key, value in additional_metadata.items():
            if value is None:
                sanitized_metadata[key] = "None"
            elif isinstance(value, (str, int, float, bool)) or (isinstance(value, list) and all(isinstance(item, str) for item in value)):
                sanitized_metadata[key] = value
            else:
                sanitized_metadata[key] = str(value)

        metadata.update(sanitized_metadata)

    index.upsert([
        (memory_id, vector, metadata)
    ])

    # If this is a FAQ, also store it separately
    if memory_type == MEMORY_TYPES["FAQ"]:
        # Extract the question part from the message
        question = extract_question(message)
        if question:
            faq_vector = get_embedding(question)
            faq_id = f"{user_id}-faq-{uuid.uuid4()}"
            index.upsert([
                (faq_id, faq_vector, {
                    "user_id": user_id,
                    "question": question,
                    "answer": response,
                    "timestamp": timestamp,
                    "type": "faq_entry"
                })
            ])

def extract_question(text):
    """Extract a question from text if present"""
    # Simple pattern matching for questions
    question_patterns = [
        r'(?:^|\s)(?:what|how|when|where|why|who|can|could|would|will|is|are|do|does|did|should)(?:\s+\w+){2,}[?]',
        r'(?:^|\s)(?:tell me about|explain|describe)(?:\s+\w+){2,}[?]?',
        r'[^.!?]*[?]'
    ]

    for pattern in question_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            return matches[0].strip()

    return None

# Recall semantic memory by filtering matches based on user_id
def recall_semantic_memory(user_id, query, top_k=3, memory_types=None):
    query_vec = get_embedding(query)

    # Build filter
    filter_dict = {"user_id": {"$eq": user_id}}

    # Add memory type filter if specified
    if memory_types:
        if isinstance(memory_types, list):
            filter_dict["type"] = {"$in": memory_types}
        else:
            filter_dict["type"] = {"$eq": memory_types}

    res = index.query(
        vector=query_vec,
        top_k=top_k,
        include_metadata=True,
        filter=filter_dict
    )

    return res.get("matches", [])

# Get recent conversation history for context
def get_conversation_history(user_id, limit=5):
    # Query the most recent interactions for this user
    res = index.query(
        vector=[0] * 768,  # Dummy vector, we're just using filters (Gemini dimension)
        top_k=limit * 2,  # Get more than needed to filter
        include_metadata=True,
        filter={
            "user_id": {"$eq": user_id},
            "type": {"$eq": MEMORY_TYPES["INTERACTION"]}
        }
    )

    # Sort by timestamp (newest first)
    matches = res.get("matches", [])
    sorted_matches = sorted(matches, key=lambda x: x['metadata'].get('timestamp', 0), reverse=True)

    return sorted_matches[:limit]

# Get FAQs for this user
def get_user_faqs(user_id, limit=5):
    res = index.query(
        vector=[0] * 768,  # Dummy vector, we're just using filters (Gemini dimension)
        top_k=limit,
        include_metadata=True,
        filter={
            "user_id": {"$eq": user_id},
            "type": {"$eq": "faq_entry"}
        }
    )

    return res.get("matches", [])

# Get user preferences
def get_user_preferences(user_id):
    res = index.query(
        vector=[0] * 768,  # Dummy vector (Gemini dimension)
        top_k=10,
        include_metadata=True,
        filter={
            "user_id": {"$eq": user_id},
            "type": {"$eq": MEMORY_TYPES["PREFERENCE"]}
        }
    )

    preferences = {}
    for match in res.get("matches", []):
        metadata = match.get("metadata", {})
        if "preference_key" in metadata and "preference_value" in metadata:
            preferences[metadata["preference_key"]] = metadata["preference_value"]

    return preferences

# Store user preference
def store_user_preference(user_id, key, value):
    # Check if preference already exists
    res = index.query(
        vector=[0] * 768,  # Gemini dimension
        top_k=1,
        include_metadata=True,
        filter={
            "user_id": {"$eq": user_id},
            "type": {"$eq": MEMORY_TYPES["PREFERENCE"]},
            "preference_key": {"$eq": key}
        }
    )

    matches = res.get("matches", [])
    timestamp = int(time.time())

    if matches:
        # Update existing preference
        memory_id = matches[0]["id"]
        vector = get_embedding(f"{key}: {value}")

        index.upsert([
            (memory_id, vector, {
                "user_id": user_id,
                "preference_key": key,
                "preference_value": value,
                "timestamp": timestamp,
                "type": MEMORY_TYPES["PREFERENCE"]
            })
        ])
    else:
        # Create new preference
        memory_id = f"{user_id}-pref-{uuid.uuid4()}"
        vector = get_embedding(f"{key}: {value}")

        index.upsert([
            (memory_id, vector, {
                "user_id": user_id,
                "preference_key": key,
                "preference_value": value,
                "timestamp": timestamp,
                "type": MEMORY_TYPES["PREFERENCE"]
            })
        ])

# Format conversation history into a readable context
def format_conversation_context(history):
    # Reverse to get chronological order (oldest first)
    history = list(reversed(history))
    context = []

    for item in history:
        metadata = item['metadata']
        context.append(f"User: {metadata['message']}")
        context.append(f"Assistant: {metadata['response']}")

    return "\n".join(context)

# Search the web for additional information
def search_web(query, num_results=3):
    try:
        headers = {
            'X-API-KEY': serper_api_key,
            'Content-Type': 'application/json'
        }

        payload = json.dumps({
            "q": query,
            "num": num_results
        })

        response = requests.post('https://google.serper.dev/search', headers=headers, data=payload)

        if response.status_code == 200:
            results = response.json()
            organic_results = results.get('organic', [])

            formatted_results = []
            for result in organic_results:
                title = result.get('title', '')
                snippet = result.get('snippet', '')
                link = result.get('link', '')
                formatted_results.append(f"Title: {title}\nSnippet: {snippet}\nURL: {link}\n")

            return "\n".join(formatted_results)
        else:
            logger.error(f"Web search failed with status code {response.status_code}")
            return ""
    except Exception as e:
        logger.error(f"Error during web search: {str(e)}")
        return ""

# Extract content from a webpage
def extract_webpage_content(url):
    try:
        headers = {
            'Authorization': f'Bearer {jina_api_key}'
        }

        response = requests.post(
            'https://api.jina.ai/v1/reader',
            json={"url": url},
            headers=headers
        )

        if response.status_code == 200:
            result = response.json()
            return result.get('text', '')
        else:
            logger.error(f"Webpage extraction failed with status code {response.status_code}")
            return ""
    except Exception as e:
        logger.error(f"Error during webpage extraction: {str(e)}")
        return ""

# Process user query using Agno agent with Gemini 1.5 Pro
def process_with_agno_agent(user_id, message, context=None):
    """
    Process a user query using Grok first, then fall back to Agno agent with Gemini 1.5 Pro

    Args:
        user_id (str): User identifier
        message (str): User message
        context (str, optional): Additional context to provide to the agent

    Returns:
        str: Agent response
    """
    try:
        # Get user preferences and history for context
        preferences = get_user_preferences(user_id)
        conversation_history = get_conversation_history(user_id, limit=3)
        conversation_context = format_conversation_context(conversation_history)

        # Create custom instructions with context
        instructions = dedent(f"""
            You are a helpful assistant for Tranquility Spa & Wellness Center.

            BUSINESS INFORMATION:
            Name: {SPA_BUSINESS['name']}
            Description: {SPA_BUSINESS['description']}
            Booking Policy: {SPA_BUSINESS['booking_policy']}
            Cancellation Policy: {SPA_BUSINESS['cancellation_policy']}

            USER INFORMATION:
            User ID: {user_id}

            {f"USER PREFERENCES:\\n{chr(10).join([f'{k}: {v}' for k, v in preferences.items()])}" if preferences else ""}

            {f"RECENT CONVERSATION:\\n{conversation_context}" if conversation_context else ""}

            {context if context else ""}

            Respond in a friendly, helpful manner. Be concise but thorough in your responses.
            If you don't know something, say so rather than making up information.
        """)

        # Try using Grok API first
        try:
            logger.info("Attempting to process query with Grok")
            # Create a prompt for Grok that includes the instructions
            grok_prompt = f"""
            {instructions}

            User query: {message}

            Please respond to this query based on the instructions and context provided.
            """

            # Call Grok API
            grok_response = generate_with_grok(grok_prompt)

            if grok_response:
                logger.info("Successfully processed query with Grok")
                # Store the interaction in memory
                store_memory(user_id, message, grok_response)
                return grok_response
        except Exception as grok_error:
            logger.warning(f"Grok processing failed, falling back to Gemini: {str(grok_error)}")
            # Continue to Gemini fallback

        # Fall back to Gemini with Agno agent if Grok fails
        logger.info("Falling back to Gemini for query processing")

        # Create the agent with key rotation on failure
        try:
            agent = get_agno_agent_with_retry(instructions=instructions)
        except Exception as e:
            logger.error(f"Failed to create agent after retries: {str(e)}")
            return "I'm sorry, but I encountered an error while processing your request. Please try again later."

        # Get response
        response = agent.print_response(message, return_response=True)

        # Store the interaction in memory
        store_memory(user_id, message, response)

        return response
    except Exception as e:
        logger.error(f"Error processing with Agno agent: {str(e)}")
        return "I'm sorry, but I encountered an error while processing your request. Please try again later."

# Analyze user message for intent and entities
def analyze_message(message):
    # Define patterns for different intents
    booking_patterns = [
        r'book(?:ing)?', r'appoint(?:ment)?', r'schedule', r'reserve',
        r'available', r'time(?:s)?', r'slot(?:s)?', r'when can I',
        r'make a booking', r'book a', r'confirm', r'reservation'
    ]

    pricing_patterns = [
        r'price(?:s)?', r'cost(?:s)?', r'how much', r'fee(?:s)?',
        r'rate(?:s)?', r'pricing', r'dollar(?:s)?', r'\$', r'₹', r'inr'
    ]

    service_patterns = [
        r'service(?:s)?', r'massage', r'facial', r'treatment(?:s)?',
        r'package(?:s)?', r'offer(?:ing)?', r'spa', r'therapy'
    ]

    policy_patterns = [
        r'policy', r'policies', r'cancel(?:lation)?', r'refund',
        r'reschedule', r'change', r'booking policy'
    ]

    # Check for intents
    intents = []

    if any(re.search(pattern, message, re.IGNORECASE) for pattern in booking_patterns):
        intents.append("booking")

    if any(re.search(pattern, message, re.IGNORECASE) for pattern in pricing_patterns):
        intents.append("pricing")

    if any(re.search(pattern, message, re.IGNORECASE) for pattern in service_patterns):
        intents.append("service_info")

    if any(re.search(pattern, message, re.IGNORECASE) for pattern in policy_patterns):
        intents.append("policy")

    # Extract service names if mentioned
    service_entities = []
    # Get services from database for entity extraction
    try:
        services = get_services_from_db()
        if services:
            for service in services:
                # Convert to string to ensure we can call lower() and handle None values
                service_name = str(service["name"]).lower() if service["name"] is not None else ""
                if service_name and service_name in message.lower():
                    service_entities.append(str(service["name"]))
    except Exception as e:
        logger.error(f"Error extracting service entities: {str(e)}")

    # Check for date entities
    date_entities = []
    date_patterns = [
        r'(\d{4}-\d{2}-\d{2})',  # YYYY-MM-DD
        r'(\d{1,2}/\d{1,2}/\d{4})',  # MM/DD/YYYY
        r'(tomorrow|next\s+\w+day|this\s+\w+day|\w+day)'  # Natural language
    ]

    for pattern in date_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            date_entities.append(match.group(1))

    # Check for month and day mentions (like "april 7")
    month_pattern = r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})'
    month_match = re.search(month_pattern, message, re.IGNORECASE)
    if month_match:
        month_name = month_match.group(1).lower()
        day = int(month_match.group(2))

        # Convert month name to number
        month_dict = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12
        }

        month_num = month_dict.get(month_name)
        if month_num:
            # Use current year or next year if the date is in the past
            current_date = datetime.now()
            year = current_date.year

            # If the month is earlier than current month, use next year
            if month_num < current_date.month:
                year += 1
            # If same month but day is earlier, use next year
            elif month_num == current_date.month and day < current_date.day:
                year += 1

            date_str = f"{year}-{month_num:02d}-{day:02d}"
            date_entities.append(date_str)

    # Check for time entities
    time_entities = []
    time_pattern = r'(\d{1,2}:\d{2}\s*[AP]M|\d{1,2}\s*[AP]M|\d{1,2}[AP]M)'

    for match in re.finditer(time_pattern, message, re.IGNORECASE):
        time_entities.append(match.group(1))

    return {
        "intents": intents,
        "service_entities": service_entities,
        "date_entities": date_entities,
        "time_entities": time_entities
    }

# Process user message and generate response
def process_message(user_id, message):
    # Analyze message for intents and entities
    analysis = analyze_message(message)
    intents = analysis["intents"]
    service_entities = analysis["service_entities"]
    date_entities = analysis.get("date_entities", [])
    time_entities = analysis.get("time_entities", [])

    # Handle "who am I" or similar identity queries
    if message.lower().strip() in ["who am i", "who am i?", "tell me about myself"]:
        preferences = get_user_preferences(user_id)
        semantic_memories = recall_semantic_memory(user_id, "user identity", top_k=1)
        
        response_text = f"You’re user {user_id} at Tranquility Spa & Wellness Center! "
        if preferences:
            response_text += "I know you prefer: " + ", ".join([f"{k}: {v}" for k, v in preferences.items()]) + ". "
        if semantic_memories:
            last_meta = semantic_memories[0]['metadata']
            last_user_text = last_meta.get('message', last_meta.get('question', ''))
            if last_user_text:
                response_text += f"Last time, you asked about '{last_user_text}'. "
        response_text += "How can I assist you today?"
        
        store_memory(user_id, message, response_text)
        return response_text

    # Store service interests if detected
    for service in service_entities:
        store_memory(
            user_id,
            message,
            f"User showed interest in {service}",
            MEMORY_TYPES["SERVICE_INTEREST"],
            {"service_name": service}
        )

    # Get recent conversation history
    conversation_history = get_conversation_history(user_id)
    conversation_context = format_conversation_context(conversation_history)

    # Get semantically similar memories
    semantic_memories = recall_semantic_memory(user_id, message)
    semantic_context = ""
    if semantic_memories:
        context_lines = []
        for m in semantic_memories:
            metadata = m.get('metadata', {})
            user_text = metadata.get('message', metadata.get('question', ''))
            bot_text = metadata.get('response', metadata.get('answer', ''))
            if user_text and bot_text:
                context_lines.append(f"Related memory: User: {user_text}\nAssistant: {bot_text}")
        semantic_context = "\n\n".join(context_lines) if context_lines else "No relevant memories found."

    # Get user FAQs
    user_faqs = get_user_faqs(user_id)
    faq_context = "\n\n".join([
        f"FAQ: {m['metadata']['question']}\nAnswer: {m['metadata']['answer']}"
        for m in user_faqs
    ])

    # Get user preferences
    preferences = get_user_preferences(user_id)
    preference_context = "\n".join([f"{key}: {value}" for key, value in preferences.items()])

    # Prepare business information based on intents
    business_info = f"Business Name: {SPA_BUSINESS['name']}\nDescription: {SPA_BUSINESS['description']}\n"

    if "booking" in intents:
        business_info += f"\nBooking Policy: {SPA_BUSINESS['booking_policy']}\n"

        # Use the simulated data for now, only use agno for actual booking creation
        available_slots = {}
        today = datetime.now()

        for i in range(7):  # 7 days ahead
            date = today + timedelta(days=i)
            day_name = date.strftime("%A")
            date_str = date.strftime("%Y-%m-%d")

            # Skip if business is closed that day
            if day_name not in SPA_BUSINESS["hours"]:
                continue

            # Parse business hours
            hours = SPA_BUSINESS["hours"][day_name]
            start_time, end_time = hours.split(" - ")

            # Convert to datetime objects
            start_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %I:%M %p")
            end_dt = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %I:%M %p")

            # Generate time slots every 30 minutes
            slots = []
            current = start_dt
            while current < end_dt:
                # Simulate some slots being already booked
                if hash(current.strftime("%Y-%m-%d %H:%M")) % 3 != 0:  # 1/3 of slots are booked
                    slots.append(current.strftime("%I:%M %p"))
                current += timedelta(minutes=30)

            if slots:
                available_slots[date_str] = slots

        if service_entities:
            service_name = service_entities[0]
            business_info += f"Available time slots for {service_name} in the next 7 days:\n"
        else:
            business_info += f"Available time slots for the next 7 days:\n"

        for date, slots in available_slots.items():
            business_info += f"{date}: {', '.join(slots[:5])}"
            if len(slots) > 5:
                business_info += f" and {len(slots) - 5} more slots"
            business_info += "\n"

    if "pricing" in intents or "service_info" in intents:
        # Initialize agno agent for service information
        try:
            db_url = f"postgresql+psycopg://{os.getenv('1user')}:{os.getenv('1password')}@{os.getenv('1host')}:{os.getenv('1port')}/{os.getenv('1dbname')}"

            # Create Agno agent with Gemini 1.5 Pro and SQL tools
            sql_tools = SQLTools(db_url=db_url)
            agent_instructions = dedent("""
                You are a spa service information specialist for Tranquility Spa & Wellness Center.
                Provide detailed and accurate information about our services, including prices, durations, and descriptions.
                Format the information in a clear, easy-to-read manner.
                If specific services are requested, focus on providing details about those services.

                DATABASE SCHEMA (EXACT NAMES - DO NOT MODIFY):
                - Table name: public.services (not spa_services)
                  Columns: "Service ID", "Service Name", "Description", "Price (INR)", "Category"
                  Note: Column names include spaces and must be quoted in SQL queries

                EXAMPLE CORRECT SQL QUERIES:
                - SELECT * FROM public.services WHERE "Service Name" = 'Glowing Facial'
                - SELECT * FROM public.services WHERE "Category" = 'Facial'
            """)
            # Create agent and query for services
            agent = None
            try:
                agent = get_agno_agent_with_retry(instructions=agent_instructions, tools=[sql_tools])
            except Exception as e:
                logger.error(f"Failed to create Agno agent after retries: {str(e)}")
                business_info += "I'm sorry, but I couldn't retrieve the service information at this moment. Please try again later or contact us directly for service details."

            # Only proceed if we successfully created an agent
            if agent:
                # Query for services
                agent_prompt = "List all services available at the spa with their descriptions, durations, and prices."
                if service_entities:
                    service_names = ", ".join(service_entities)
                    agent_prompt = f"Find information about these spa services: {service_names}."

                business_info += "\nServices:\n"
                try:
                    agent_response = agent.print_response(agent_prompt, return_response=True)

                    if agent_response and "error" not in agent_response.lower():
                        business_info += agent_response

                        # Store the agent response for direct use in the API
                        # We'll return this directly instead of generating a new response
                        return {
                            "response": agent_response,
                            "source": "agno_agent",
                            "context": {
                                "service_entities": service_entities,
                                "intents": intents
                            }
                        }
                    else:
                        business_info += "I'm sorry, but I couldn't retrieve the service information at this moment. Please try again later or contact us directly for service details."
                except Exception as e:
                    logger.error(f"Error getting service information from agent: {str(e)}")
                    business_info += "I'm sorry, but I couldn't retrieve the service information at this moment. Please try again later or contact us directly for service details."
        except Exception as e:
            logger.error(f"Error retrieving service information: {str(e)}")
            business_info += "I'm sorry, but I couldn't retrieve the service information at this moment. Please try again later or contact us directly for service details."

    if "policy" in intents:
        business_info += f"\nCancellation Policy: {SPA_BUSINESS['cancellation_policy']}\n"

    # Combine all context
    context = "You are a helpful assistant for Tranquility Spa & Wellness Center. Use the following information to answer the user's question.\n\n"
    context += f"BUSINESS INFORMATION:\n{business_info}\n\n"
    if preference_context:
        context += f"USER PREFERENCES:\n{preference_context}\n\n"
    if conversation_context:
        context += f"RECENT CONVERSATION HISTORY:\n{conversation_context}\n\n"
    if semantic_context:
        context += f"RELEVANT MEMORIES:\n{semantic_context}\n\n"
    if faq_context:
        context += f"FREQUENTLY ASKED QUESTIONS:\n{faq_context}\n\n"

    # Create the final prompt
    prompt = f"{context}\nUser: {message}\n\nAssistant:"

    # Generate response using our generate_content function (tries Grok first, then falls back to Gemini)
    response_text = generate_content(prompt)

    # If we somehow didn't get a response_text (should never happen due to fallback)
    if response_text is None:
        response_text = "I'm sorry, but I'm having trouble generating a response right now. Please try again later."

    # Check if this is a booking-related message
    booking_request = False

    # Check if the message contains booking intent or mentions booking
    if "booking" in intents or any(word in message.lower() for word in ["book", "schedule", "reserve", "make appointment", "booking", "slot", "appointment"]):
        # Handle booking with Agno
        booking_response = handle_booking_with_agno(
            user_id,
            message,
            intents,
            service_entities,
            date_entities,
            time_entities
        )

        # Replace the generated response with the booking response if we got one
        if booking_response:
            # Store the booking response for memory
            response_text = booking_response

            # If booking was confirmed, mark as booking request
            if "confirmed" in booking_response.lower() or "booked" in booking_response.lower():
                booking_request = True

            # Store the booking interaction in memory
            store_memory(
                user_id,
                message,
                booking_response,
                MEMORY_TYPES["BOOKING"],
                {
                    "service": service_entities[0] if service_entities else None,
                    "date": date_entities[0] if date_entities else None,
                    "time": time_entities[0] if time_entities else None
                }
            )

            # Return the direct Agno response
            return booking_response
        # If booking_response is None, keep the original response_text

    # Check if this is a FAQ
    if extract_question(message):
        is_faq = any(intent in intents for intent in ["pricing", "service_info", "policy", "booking"])
        memory_type = MEMORY_TYPES["FAQ"] if is_faq else MEMORY_TYPES["INTERACTION"]
        store_memory(user_id, message, response_text, memory_type)
    else:
        store_memory(user_id, message, response_text)

    # If this was a booking request, store it as booking memory
    if booking_request:
        # Extract service name from the response for metadata
        service_match = None
        try:
            services = get_services_from_db()
            if services:
                for service in services:
                    # Convert to string to ensure we can call lower()
                    service_name = str(service["name"]).lower()
                    if service_name in response_text.lower():
                        service_match = str(service["name"])
                        break
        except Exception as e:
            logger.error(f"Error extracting service from booking: {str(e)}")

        additional_metadata = {"service_booked": service_match} if service_match else None
        store_memory(user_id, message, response_text, MEMORY_TYPES["BOOKING"], additional_metadata)

    # Extract and store preferences in a separate thread
    threading.Thread(target=extract_and_store_preferences, args=(user_id, message, response_text)).start()

    return response_text

# This function is no longer used as booking is handled by Agno
# Keeping the function signature for reference
def create_booking(user_id, service_name, booking_date, time_slot):
    """
    This function is deprecated. Booking is now handled by Agno.
    """
    logger.warning("create_booking function is deprecated. Booking is now handled by Agno.")
    return False, "Booking functionality has been moved to Agno."

def extract_and_store_preferences(user_id, message, response):
    """Extract and store user preferences from the conversation"""
    # Look for service preferences from database
    try:
        services = get_services_from_db()
        if services:
            for service in services:
                # Convert to string to ensure we can call lower() and handle None values
                service_name = str(service["name"]).lower() if service["name"] is not None else ""
                if service_name and service_name in message.lower() and any(word in message.lower() for word in ["like", "prefer", "favorite", "enjoy"]):
                    store_user_preference(user_id, "preferred_service", str(service["name"]))
    except Exception as e:
        logger.error(f"Error extracting preferences: {str(e)}")

    # Look for time preferences
    time_patterns = [
        (r'prefer\s+(\w+day)', "preferred_day"),
        (r'prefer\s+(morning|afternoon|evening)', "preferred_time"),
        (r'(morning|afternoon|evening)\s+is better', "preferred_time")
    ]

    for pattern, key in time_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            store_user_preference(user_id, key, match.group(1))

# Handle booking with Agno
def handle_booking_with_agno(user_id, message, intents, service_entities, date_entities=None, time_entities=None):
    """
    Handle booking using Agno agent

    Args:
        user_id (str): User ID
        message (str): User message
        intents (list): Detected intents
        service_entities (list): Detected service entities
        date_entities (list, optional): Detected date entities
        time_entities (list, optional): Detected time entities

    Returns:
        str: Response message from Agno agent
    """
    try:
        # Create database connection string
        db_url = f"postgresql+psycopg://{os.getenv('1user')}:{os.getenv('1password')}@{os.getenv('1host')}:{os.getenv('1port')}/{os.getenv('1dbname')}"

        # Create SQL tools for Agno
        sql_tools = SQLTools(db_url=db_url)

        # Create booking agent with specific instructions
        booking_instructions = dedent("""
            You are a booking assistant for Tranquility Spa & Wellness Center.

            IMPORTANT BOOKING RULES:
            1. Bookings must be made at least 4 hours in advance
            2. Available time slots are from 9:00 AM to 7:00 PM, every hour
            3. Each service has a 1 hour duration and price
            4. The user must provide: service name, date, and time
            5. Check if the requested time slot is available by querying using the particular date and time before confirming by checking bookings table for any existing booking of any service in that particular day and time slot

            DATABASE SCHEMA (EXACT NAMES - DO NOT MODIFY):
            - Table name: public.services (not spa_services)
              Columns: "Service ID", "Service Name", "Description", "Price (INR)", "Category"
              Note: Column names include spaces and must be quoted in SQL queries

            - Table name: public.bookings
              Columns: "Booking ID", "Customer Name", "Service ID", "Booking Date", "Time Slot (HH:MM)", "Price (INR)"
              Note: Column names include spaces and must be quoted in SQL queries
            create table public.services (
                "Service ID" bigint generated by default as identity not null,
                "Service Name" text not null,
                "Description" text null,
                "Price (INR)" double precision null,
                "Category" text null,
                constraint services_pkey primary key ("Service ID")
            ) TABLESPACE pg_default;

            create table public.bookings (
                "Booking ID" bigint generated by default as identity not null,
                "Customer Name" text not null,
                "Service ID" bigint not null,
                "Booking Date" date null,
                "Time Slot (HH:MM)" time without time zone null,
                "Price (INR)" double precision null,
                constraint bookings_pkey primary key ("Booking ID"),
                constraint bookings_Service ID_fkey foreign KEY ("Service ID") references services ("Service ID")
            ) TABLESPACE pg_default;

            EXAMPLE CORRECT SQL QUERIES:
            - SELECT * FROM public.services WHERE "Service Name" = 'Glowing Facial'
            - SELECT * FROM public.bookings WHERE "Booking Date" = '2025-04-07'

            BOOKING PROCESS:
            1. Ask for any missing information (service, date, time) if no name write Zeke for now
            2. Check if the service exists in the database using the EXACT table and column names then use Service Name to get Service ID
            3. Check if the requested time slot is available by querying the bookings table
            4. If the slot is available, create the booking(sample: INSERT INTO public.bookings ("Customer Name", "Service ID", "Booking Date", "Time Slot (HH:MM)", "Price (INR)") VALUES ('nithin', 7, '2025-04-09', '16:00',   ┃
┃ (SELECT "Price (INR)" from public.services where "Service Name" = 'Hot Stone Massage'))) in the database and confirm with a clear success message
            5. If the slot is NOT available, inform the user and suggest alternative times

            IMPORTANT: When a booking is successfully created, your response MUST clearly state that the booking was SUCCESSFUL and CONFIRMED.
            Do NOT say the slot is already booked if you've just successfully created a booking.

            Always be helpful, professional, and provide clear instructions.
        """)

        # Create the Agno agent with key rotation on failure
        try:
            booking_agent = get_agno_agent_with_retry(instructions=booking_instructions, tools=[sql_tools])
        except Exception as e:
            logger.error(f"Failed to create booking agent after retries: {str(e)}")
            return "I'm sorry, but I'm having trouble with the booking system right now. Please try again later or contact us directly at (555) 123-4567 to make a booking."

        # Prepare the prompt for the booking agent
        booking_prompt = f"User wants to book a spa service. "

        # Add service information if available
        if service_entities:
            service_names = ", ".join(service_entities)
            booking_prompt += f"They mentioned these services: {service_names}. "

        # Add date information if available
        if date_entities:
            dates = ", ".join(date_entities)
            booking_prompt += f"They mentioned these dates: {dates}. "

        # Add time information if available
        if time_entities:
            times = ", ".join(time_entities)
            booking_prompt += f"They mentioned these times: {times}. "

        # Add the user's message
        booking_prompt += f"Here's what they said: '{message}'. Handle this booking request appropriately."

        # Try using Grok API first for the booking response
        grok_api_key = get_grok_api_key()
        if not grok_api_key:
            logger.warning("No Grok API key available, using Gemini for booking handling")
        else:
            try:
                logger.info("Attempting to handle booking with Grok")
                # Create a prompt for Grok that includes the booking instructions and SQL tools context
                grok_booking_prompt = f"""
                {booking_instructions}

                You have access to a SQL database with the schema described above.
                Please help the user with their booking request:

                {booking_prompt}

                IMPORTANT REMINDER:
                1. After successfully creating a booking in the database, your response MUST clearly state that the booking was SUCCESSFUL and CONFIRMED.
                2. Do NOT say the slot is already booked if you've just successfully created a booking.
                3. Only say a slot is unavailable if you've checked the database and found an existing booking for that exact date and time.
                """

                # Call Grok API
                booking_response = generate_with_grok(grok_booking_prompt)

                if booking_response:
                    logger.info("Successfully handled booking with Grok")
                    # Log the booking interaction
                    logger.info(f"Booking interaction (Grok) - User: {user_id}, Message: {message}, Response: {booking_response[:100]}...")

                    # Check for contradictory information in the response
                    if "successfully" in booking_response.lower() or "confirmed" in booking_response.lower() or "booked" in booking_response.lower():
                        # If it's a successful booking, make sure it doesn't also say the slot is unavailable
                        if "already booked" in booking_response.lower() or "not available" in booking_response.lower() or "unavailable" in booking_response.lower():
                            # Fix the contradictory response
                            booking_response = booking_response.replace("Unfortunately, the", "Great news! The")
                            booking_response = booking_response.replace("already booked", "has been successfully booked for you")
                            booking_response = booking_response.replace("not available", "now booked for you")
                            booking_response = booking_response.replace("unavailable", "reserved for you")

                    return booking_response
                else:
                    logger.warning("Grok returned empty response, falling back to Gemini")
            except requests.exceptions.RequestException as req_error:
                # Network or API-specific errors
                logger.warning(f"Grok API request failed, falling back to Gemini: {str(req_error)}")
            except Exception as grok_error:
                # Other unexpected errors
                logger.warning(f"Grok booking handling failed with unexpected error, falling back to Gemini: {str(grok_error)}")

        # Fall back to Gemini with Agno agent if Grok is unavailable or fails
        logger.info("Falling back to Gemini for booking handling")
        max_retries = min(2, len(gemini_api_keys))
        for retry in range(max_retries):
            try:
                # If this is a retry, get a new agent with a fresh API key
                if retry > 0:
                    logger.info(f"Retrying booking agent with new API key (attempt {retry+1})")
                    rotate_gemini_key()
                    booking_agent = get_agno_agent(instructions=booking_instructions, tools=[sql_tools])

                # Try to get a response
                agent_response = booking_agent.print_response(booking_prompt, return_response=True)
                print(agent_response)
                # Make sure we have a valid response
                if agent_response is None:
                    raise ValueError("Agno agent returned None response")

                # Log the booking interaction
                logger.info(f"Booking interaction (Gemini) - User: {user_id}, Message: {message}, Response: {agent_response[:100]}...")

                # Check for contradictory information in the response
                if "successfully" in agent_response.lower() or "confirmed" in agent_response.lower() or "booked" in agent_response.lower():
                    # If it's a successful booking, make sure it doesn't also say the slot is unavailable
                    if "already booked" in agent_response.lower() or "not available" in agent_response.lower() or "unavailable" in agent_response.lower():
                        # Fix the contradictory response
                        agent_response = agent_response.replace("Unfortunately, the", "Great news! The")
                        agent_response = agent_response.replace("already booked", "has been successfully booked for you")
                        agent_response = agent_response.replace("not available", "now booked for you")
                        agent_response = agent_response.replace("unavailable", "reserved for you")

                return agent_response
            except Exception as inner_e:
                logger.error(f"Error getting response from Agno agent (attempt {retry+1}/{max_retries}): {str(inner_e)}")
                if retry < max_retries - 1:
                    # Will retry with a new key
                    continue
                else:
                    # All retries failed, return a fallback response
                    return "I'd be happy to help you book a spa service. Could you please tell me which service you're interested in, what date, and what time you prefer? Alternatively, you can contact us directly at (555) 123-4567 to make a booking."

    except Exception as e:
        logger.error(f"Error handling booking with Agno: {str(e)}")
        return "I'm sorry, but I'm having trouble with the booking system right now. Please try again later or contact us directly at (555) 123-4567 to make a booking."




# Chat interface with improved context handling
def chat():
    user_id = input("Enter your user ID: ").strip()
    print(f"Tranquility Spa Assistant: Welcome to Tranquility Spa & Wellness Center, {user_id}! How can I help you today?")

    while True:
        try:
            message = input("You: ")
        except KeyboardInterrupt:
            print("\nTransquility Spa Assistant: Thank you for chatting with us. Have a relaxing day!")
            break

        if message.lower() in ["exit", "quit", "bye"]:
            print("Tranquility Spa Assistant: Thank you for chatting with us. Have a relaxing day!")
            break

        response = process_message(user_id, message)
        print("Tranquility Spa Assistant:", response)

# Entry point
if __name__ == "__main__":
    chat()
