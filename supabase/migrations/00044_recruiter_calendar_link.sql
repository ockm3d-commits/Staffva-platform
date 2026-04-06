-- Add calendar_link to profiles table for recruiter Google Calendar booking URL
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_link text;
