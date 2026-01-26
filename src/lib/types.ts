

import { type Timestamp } from "firebase/firestore";

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

export interface QuotedPost {
    id: string;
    authorId: string;
    authorName: string; 
    authorAvatar: string; 
    content: string;
    timestamp: Timestamp;
}

export interface Event {
    id: string;
    authorId: string;
    name: string;
    description?: string;
    isPaid: boolean;
    eventTimestamp: Timestamp;
    endTimestamp?: Timestamp;
    isAllDay: boolean;
    location: string;
    reach?: number;
    type?: 'public' | 'private';
}

export interface EventDetails {
    id: string;
    name: string;
    description?: string;
    eventTimestamp: Timestamp;
    endTimestamp?: Timestamp;
    isAllDay: boolean;
    location: string;
    isPaid?: boolean;
}

export interface Post {
    id: string;
    timestamp: Timestamp;
    authorId: string;
    content?: string;
    likes: string[];
    likeCount: number;
    repostCount: number;
    commentCount: number;
    commentsAllowed?: boolean;
    isPinned?: boolean;
    expiresAt?: Timestamp;

    type?: 'text' | 'poll' | 'repost' | 'quote' | 'audio' | 'event';

    pollOptions?: PollOption[];
    voters?: Record<string, number>; 

    linkMetadata?: LinkMetadata;

    repostOf?: string; 
    quotedPost?: QuotedPost; 

    audioUrl?: string;
    audioWaveform?: number[];
    audioDuration?: number;

    eventDetails?: EventDetails;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    timestamp: Timestamp;
    postAuthorId?: string;
    status: 'approved' | 'pending_approval';
    lastEdited?: Timestamp;
}

export interface NotificationSettings {
    push: boolean;
    likes: boolean;
    comments: boolean;
    reposts: boolean;
    followers: boolean;
    messageRequests: boolean;
}

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    avatar?: string;
    createdAt?: Timestamp;
    followersCount?: number;
    followedBy?: string[];
    followingCount?: number;
    following?: string[];
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
}

export interface Notification {
    id: string;
    type: 'comment' | 'comment_approval' | 'follow' | 'message_request' | 'like' | 'repost' | 'quote' | 'new_post';
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
    lastUpdated: any; 
    status: 'pending' | 'accepted';
    requesterId: string;
    unreadCounts?: Record<string, number>;
    lastReadTimestamps?: Record<string, any>;
    mutedBy?: string[];
    postId?: string;
    voiceCallsDisabledBy?: string[];
    videoCallsDisabledBy?: string[];
}

export interface Message {
    id: string;
    senderId: string;
    text?: string;
    timestamp: any; 
    replyToMessageId?: string;
    replyToMessageText?: string;
    postId?: string;
    isForwarded?: boolean;
    linkMetadata?: LinkMetadata;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  theme: 'violet' | 'teal';
  participantIds: string[];
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  text?: string;
  timestamp: Timestamp;
  replyToMessageId?: string;
  replyToMessageText?: string;
  postId?: string;
  isForwarded?: boolean;
  linkMetadata?: LinkMetadata;
}


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
    id:string;
    reporterUserId: string;
    reportedUserId: string;
    reason: string;
    timestamp: any; 
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
