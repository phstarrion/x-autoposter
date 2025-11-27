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
