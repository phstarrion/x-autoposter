-- Add media column to scheduled_posts
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

-- Add media column to drafts
ALTER TABLE drafts
ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

-- Comment describing the structure
COMMENT ON COLUMN scheduled_posts.media IS 'Array of {url: string, type: "image"|"video"}';
COMMENT ON COLUMN drafts.media IS 'Array of {url: string, type: "image"|"video"}';
