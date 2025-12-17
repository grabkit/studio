export interface Post {
    id: string;
    authorId: string;
    content: string;
    timestamp: any; // Firestore ServerTimestamp
}
