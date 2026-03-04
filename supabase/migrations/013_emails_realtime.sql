-- Enable Realtime on the emails table
-- This allows the UI to receive instant notifications when new emails arrive
ALTER PUBLICATION supabase_realtime ADD TABLE emails;
