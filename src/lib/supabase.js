import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for interacting with your database
const supabaseUrl = 'https://vkqpoixggppqumweltyk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcXBvaXhnZ3BwcXVtd2VsdHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NTE0ODksImV4cCI6MjA1OTQyNzQ4OX0.kmHTmgT6nc51BGPQfzlmWahB4_K6OY4vyBtv0Bcr6oo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;