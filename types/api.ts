export type ScheduledPost = {
    id: number;
    text: string;
    scheduled_at: string;
    status: "pending" | "sent" | "failed";
    tweet_id?: string;
    created_at: string;
    sort_order?: number;
    media?: {
        url: string;
        type: "image" | "video";
    }[];
};

export type PostResponse = {
    success: boolean;
    tweetId?: string;
    text?: string;
    error?: string;
    post?: ScheduledPost;
};

export type Draft = {
    id: string;
    text: string;
    source: string;
    meta: {
        char_count?: number;
        ready_to_post?: boolean;
        checks?: Record<string, { passed: boolean; note: string }>;
    } | null;
    created_at: string;
    media?: {
        url: string;
        type: "image" | "video";
    }[];
};
