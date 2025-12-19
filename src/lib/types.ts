import { type Timestamp } from "firebase/firestore";

export interface PollOption {
    option: string;
    votes: number;
}

export interface Post {
    id: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
    likes: string[];
    likeCount: number;
    commentCount: number;
    commentsAllowed?: boolean;

    // Poll specific fields
    type?: 'text' | 'poll';
    pollOptions?: PollOption[];
    voters?: Record<string, number>; // maps userId to option index
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
}

export interface User {
    id: string;
    name: string;
    email: string;
    anonymousId?: string;
}

export interface Bookmark {
    id: string;
    postId: string;
    timestamp: Timestamp;
}

export interface UserPost extends Post {
    // This can be extended with user-specific post data if needed in future
}

export interface Notification {
    id: string;
    type: 'like' | 'comment';
    postId: string;
    postContent: string;
    fromUserId: string;
    timestamp: Timestamp;
    read: boolean;
}
