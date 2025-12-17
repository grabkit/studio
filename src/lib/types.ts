export interface Post {
    id: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string;
    content: string;
    timestamp: any; // Firestore ServerTimestamp
}
