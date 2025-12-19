import { type Timestamp } from "firebase/firestore";

export interface Post {
    id: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
    likes: string[]; // Array of user IDs who liked the post
    likeCount: number;
    commentCount: number;
    commentsAllowed?: boolean;
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
    itemId: string;
    itemType: 'post' | 'video' | 'product';
    originalOwnerId: string;
    createdAt: Timestamp;
}
