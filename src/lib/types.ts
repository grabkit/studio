import { type Timestamp } from "firebase/firestore";

export type PollOption = {
    option: string;
    votes: number;
};

export interface Post {
    id: string;
    authorId: string;
    content: string;
    type: 'text' | 'poll';
    timestamp: Timestamp;

    // Poll specific fields
    pollOptions?: PollOption[];
    voters?: { [userId: string]: number }; // Map of userId to option index

    // Engagement fields
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
