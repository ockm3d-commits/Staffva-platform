-- Add recruiting_manager to the user_role_type enum
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'recruiting_manager';

-- Assign recruiting_manager role to Manar
UPDATE profiles
SET role = 'recruiting_manager'
WHERE email = 'careers@globalstaffing.asia';
