

import { type Timestamp } from "firestore";

export interface LinkMetadata {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    faviconUrl?: string;
}

export interface PollOption {
    option: string;
    votes: number;
}

// Represents the essential data of a post being quoted.
// Stored denormalized within a quote post.
export interface QuotedPost {
    id: string;
    authorId: string;
    authorName: string; // e.g., formatUserId(authorId)
    authorAvatar: string; // e.g., getAvatar(author)
    content: string;
    timestamp: Timestamp;
}

export interface Post {
    id: string;
    timestamp: Timestamp;
    authorId: string;
    content: string;
    likes: string[];
    likeCount: number;
    repostCount: number;
    commentCount: number;
    commentsAllowed?: boolean;
    isPinned?: boolean;

    // Type of post
    type?: 'text' | 'poll' | 'repost' | 'quote';

    // Poll specific fields
    pollOptions?: PollOption[];
    voters?: Record<string, number>; // maps userId to option index

    // Link specific fields
    linkMetadata?: LinkMetadata;

    // Repost/Quote specific fields
    repostOf?: string; // ID of the original post, for simple reposts
    quotedPost?: QuotedPost; // Denormalized data for a quoted post
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
    postAuthorId?: string; // This might be added in the fetch logic
    status: 'approved' | 'pending_approval';
    lastEdited?: Timestamp;
}

export interface NotificationSettings {
    push: boolean;
    likes: boolean;
    comments: boolean;
    reposts: boolean;
    upvotes: boolean;
    messageRequests: boolean;
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    createdAt?: Timestamp;
    upvotes?: number;
    upvotedBy?: string[];
    upvotedCount?: number;
    upvotedTo?: string[];
    status?: 'active' | 'suspended' | 'banned';
    blockedUsers?: string[];
    mutedUsers?: string[];
    restrictedUsers?: string[];
    lastReadTimestamps?: Record<string, any>;
    bio?: string;
    website?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | '';
    voiceStatusUrl?: string;
    voiceStatusTimestamp?: Timestamp;
    notificationSettings?: NotificationSettings;
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
    type: 'comment' | 'comment_approval' | 'upvote' | 'message_request' | 'like' | 'repost' | 'quote';
    postId?: string;
    activityContent?: string;
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
    mutedBy?: string[];
    postId?: string;
}

export interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any; // Can be Timestamp or FieldValue
    replyToMessageId?: string;
    replyToMessageText?: string;
    postId?: string;
    isForwarded?: boolean;
}


// Specific type for the replies list
export interface ReplyItem extends Comment {
    postContent: string;
}

export interface ProblemReport {
    id: string;
    reporterUserId: string;
    category: string;
    description: string;
    timestamp: any;
}

export interface Report {
    id: string;
    reporterUserId: string;
    reportedUserId: string;
    reason: string;
    timestamp: any; // Can be Timestamp or FieldValue
    status: 'pending' | 'reviewed' | 'action-taken';
}

export type CallStatus = 'offering' | 'ringing' | 'answered' | 'ended' | 'declined' | 'missed';

export interface Call {
  id: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  offer?: { sdp: string; type: string };
  answer?: { sdp: string; type: string };
  createdAt: Timestamp;
  endedAt?: Timestamp;
}

export interface IceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
}

export interface VideoCall {
  id: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  offer?: { sdp: string; type: string };
  answer?: { sdp: string; type: string };
  createdAt: Timestamp;
  endedAt?: Timestamp;
}

export interface VideoIceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
}
