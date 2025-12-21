-- Add sort_order column to scheduled_posts for drag-and-drop reordering
-- Run this in Supabase SQL Editor

-- Add sort_order column
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS sort_order bigint;

-- Backfill existing records with created_at epoch
UPDATE scheduled_posts
SET sort_order = extract(epoch from created_at)::bigint
WHERE sort_order IS NULL;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS scheduled_posts_sort_order_idx
ON scheduled_posts (sort_order ASC);

-- Comment
COMMENT ON COLUMN scheduled_posts.sort_order IS 'Sort order for drag-and-drop reordering, lower values appear first';
