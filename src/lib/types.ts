import { type Timestamp } from "firebase/firestore";

export interface Post {
    id: string;
    authorId: string;
    content: string;
    timestamp: any; // Firestore ServerTimestamp
    likes: string[]; // Array of user IDs who liked the post
    likeCount: number;
    commentCount: number;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    timestamp: any; // Firestore ServerTimestamp
}
