"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  type TouchEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  Menu,
  Plus,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";

import type { Post, Bookmark, User } from "@/lib/types";
import { cn, getAvatar, formatUserId } from "@/lib/utils";

import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import { RepliesList } from "@/components/RepliesList";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

/* -------------------------------- Bookmarks List -------------------------------- */

function BookmarksList({
  bookmarks,
  bookmarksLoading,
}: {
  bookmarks: WithId<Bookmark>[] | null;
  bookmarksLoading: boolean;
}) {
  const { firestore } = useFirebase();
  const [posts, setPosts] = useState<WithId<Post>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || bookmarksLoading) return;

    if (!bookmarks || bookmarks.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const result: WithId<Post>[] = [];

      await Promise.all(
        bookmarks.map(async (bm) => {
          const snap = await getDoc(doc(firestore, "posts", bm.postId));
          if (snap.exists()) {
            result.push({ id: snap.id, ...snap.data() } as WithId<Post>);
          }
        })
      );

      result.sort((a, b) => {
        const ta =
          bookmarks.find((x) => x.postId === a.id)?.timestamp?.toMillis() || 0;
        const tb =
          bookmarks.find((x) => x.postId === b.id)?.timestamp?.toMillis() || 0;
        return tb - ta;
      });

      setPosts(result);
      setLoading(false);
    };

    load();
  }, [firestore, bookmarks, bookmarksLoading]);

  if (loading) {
    return (
      <>
        <PostSkeleton />
        <PostSkeleton />
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="text-xl font-headline text-primary">
          No Bookmarks Yet
        </h3>
        <p className="text-muted-foreground">
          You haven't bookmarked any posts.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y border-b">
      {posts.map((post) => (
        <HomePostItem
          key={post.id}
          post={post}
          bookmarks={bookmarks}
          updatePost={() => {}}
          onDelete={() =>
            setPosts((p) => p.filter((x) => x.id !== post.id))
          }
        />
      ))}
    </div>
  );
}

/* -------------------------------- Account Page -------------------------------- */

export default function AccountPage() {
  const { user: authUser, userProfile, firestore, showVoiceStatusPlayer, setUserProfile } =
    useFirebase();
  const { toast } = useToast();

  const [posts, setPosts] = useState<WithId<Post>[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPosition, setPullPosition] = useState(0);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---------------- Fetch Posts ---------------- */

  const fetchPosts = useCallback(async () => {
    if (!firestore || !authUser) return;
    setPostsLoading(true);

    const q = query(
      collection(firestore, "posts"),
      where("authorId", "==", authUser.uid)
    );

    const snap = await getDocs(q);
    const data = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as WithId<Post>)
    );

    data.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
    });

    setPosts(data);
    setPostsLoading(false);
  }, [firestore, authUser]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  /* ---------------- Pull to Refresh ---------------- */

  const handleTouchStart = (e: TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const diff = e.targetTouches[0].clientY - touchStartRef.current;
    if (window.scrollY === 0 && diff > 0 && !isRefreshing) {
      e.preventDefault();
      setPullPosition(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = async () => {
    if (pullPosition > 70) {
      setIsRefreshing(true);
      await fetchPosts();
      setIsRefreshing(false);
    }
    setPullPosition(0);
  };

  /* ---------------- Bookmarks ---------------- */

  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, "users", authUser.uid, "bookmarks");
  }, [firestore, authUser]);

  const { data: bookmarks, isLoading: bookmarksLoading } =
    useCollection<Bookmark>(bookmarksQuery);

  const avatar = useMemo(() => getAvatar(userProfile), [userProfile]);
  const isAvatarUrl = avatar.startsWith("http");

  /* ---------------- Render ---------------- */

  return (
    <AppLayout showTopBar={false}>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull indicator */}
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-center h-12 z-10"
          style={{ opacity: isRefreshing ? 1 : pullPosition / 70 }}
        >
          <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
        </div>

        <div
          style={{ transform: `translateY(${pullPosition}px)` }}
          className="transition-transform bg-background"
        >
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4">
            <Link
              href="/post"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Plus className="h-6 w-6" />
            </Link>

            <h2 className="font-bold">
              {formatUserId(authUser?.uid)}
            </h2>

            <Link
              href="/account/settings"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <Menu className="h-6 w-6" />
            </Link>
          </div>

          {/* Profile */}
          <div className="px-4 pt-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={isAvatarUrl ? avatar : undefined} />
              <AvatarFallback>{!isAvatarUrl ? avatar : ""}</AvatarFallback>
            </Avatar>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="posts">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="replies">Replies</TabsTrigger>
              <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
            </TabsList>

            <TabsContent value="posts">
              {postsLoading ? (
                <>
                  <PostSkeleton />
                  <PostSkeleton />
                </>
              ) : (
                posts.map((post) => (
                  <HomePostItem
                    key={post.id}
                    post={post}
                    bookmarks={bookmarks}
                    updatePost={() => {}}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="replies">
              {authUser?.uid && <RepliesList userId={authUser.uid} />}
            </TabsContent>

            <TabsContent value="bookmarks">
              <BookmarksList
                bookmarks={bookmarks}
                bookmarksLoading={bookmarksLoading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
