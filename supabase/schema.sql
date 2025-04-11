-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create services table
CREATE TABLE IF NOT EXISTS "Services" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS "Bookings" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  service_id UUID REFERENCES "Services"(id) NOT NULL,
  booking_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact messages table
CREATE TABLE IF NOT EXISTS "ContactMessages" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample services
INSERT INTO "Services" (name, description, price, duration, category, image_url)
VALUES
  ('Swedish Massage', 'A gentle full body massage that is perfect for people who are new to massage, want a light pressure massage, or want to relax and unwind.', 89.99, 60, 'Massage', NULL),
  ('Deep Tissue Massage', 'A therapeutic massage that focuses on realigning deeper layers of muscles and connective tissue.', 109.99, 60, 'Massage', NULL),
  ('Hot Stone Massage', 'A specialty massage where smooth, heated stones are placed on specific parts of your body to help loosen and relax tight muscles and soft tissues.', 129.99, 90, 'Massage', NULL),
  ('Classic Facial', 'A deep cleansing facial that includes exfoliation, extraction, and hydration to improve the appearance of your skin.', 79.99, 60, 'Facial', NULL),
  ('Anti-Aging Facial', 'A facial treatment designed to slow the aging process, brighten skin, and reduce wrinkles.', 99.99, 60, 'Facial', NULL),
  ('Body Scrub', 'An exfoliating treatment that removes dead skin cells and stimulates the production of new ones.', 69.99, 45, 'Body Treatment', NULL),
  ('Body Wrap', 'A detoxifying treatment that helps rid the body of toxins through metabolic stimulation.', 89.99, 60, 'Body Treatment', NULL),
  ('Deluxe Spa Package', 'Includes a full body massage, facial, and body scrub for a complete spa experience.', 249.99, 180, 'Package', NULL),
  ('Couples Massage', 'A massage experience for two people in the same room, at the same time, with two different massage therapists.', 179.99, 60, 'Package', NULL);

-- Create RLS policies
-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactMessages" ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Services policies (public read)
CREATE POLICY "Services are viewable by everyone" 
  ON "Services" FOR SELECT 
  USING (true);

-- Bookings policies
CREATE POLICY "Users can view their own bookings" 
  ON "Bookings" FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings" 
  ON "Bookings" FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" 
  ON "Bookings" FOR UPDATE 
  USING (auth.uid() = user_id);

-- Contact messages policies
CREATE POLICY "Anyone can insert contact messages" 
  ON "ContactMessages" FOR INSERT 
  WITH CHECK (true);

-- Create functions and triggers
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for bookings
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON "Bookings"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();