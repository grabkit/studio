import { type Timestamp } from "firebase/firestore";

export interface Post {
    id: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
    likes: string[]; // Array of user IDs who liked the post
    likeCount: number;
    commentCount: number;
    reposts: string[]; // Array of user IDs who reposted
    repostCount: number;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
}
