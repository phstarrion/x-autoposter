export type PostSuccessResponse = {
    success: true;
    tweetId: string;
    text: string;
};

export type PostErrorResponse = {
    success: false;
    error: string;
};

export type PostResponse = PostSuccessResponse | PostErrorResponse;

export type ScheduledPost = {
    id: number;
    text: string;
    scheduled_at: string;
    status: 'pending' | 'sent' | 'failed';
    tweet_id?: string;
    created_at: string;
    sort_order?: number;
};
