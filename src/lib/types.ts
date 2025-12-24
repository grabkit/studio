
import { type Timestamp } from "firebase/firestore";

export interface PollOption {
    option: string;
    votes: number;
}

export interface Post {
    id: string;
    timestamp: Timestamp;
    authorId: string;
    content: string;
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
    postAuthorId?: string; // This might be added in the fetch logic
    status: 'approved' | 'pending_approval';
}

export interface User {
    id: string;
    name: string;
    email: string;
    anonymousId?: string;
    createdAt?: Timestamp;
    upvotes?: number;
    upvotedBy?: string[];
    status?: 'active' | 'suspended' | 'banned';
    blockedUsers?: string[];
    mutedUsers?: string[];
    restrictedUsers?: string[];
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

export interface Conversation {
    id: string;
    participantIds: string[];
    lastMessage: string;
    lastUpdated: any; // Can be Timestamp or FieldValue
    status: 'pending' | 'accepted';
    requesterId: string;
    unreadCounts?: Record<string, number>;
    lastReadTimestamps?: Record<string, any>;
}

export interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any; // Can be Timestamp or FieldValue
    replyToMessageId?: string;
    replyToMessageText?: string;
}


// Specific type for the replies list
export interface ReplyItem extends Comment {
    postContent: string;
}

export interface Report {
    id: string;
    reporterUserId: string;
    reportedUserId: string;
    reason: string;
    timestamp: any; // Can be Timestamp or FieldValue
    status: 'pending' | 'reviewed' | 'action-taken';
}

    