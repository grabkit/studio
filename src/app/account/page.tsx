"use client";

import AppLayout from "@/components/AppLayout";
import { useUser, useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where } from "firebase/firestore";
import { useCollection } from "@/firebase/firestore/use-collection";
import { Settings, LogOut, Grid3x3, Bookmark, FileText } from "lucide-react";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function AccountPage() {
  const { user } = useUser();
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const userPostsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "posts"),
      where("authorId", "==", user.uid)
    );
  }, [firestore, user]);

  const { data: posts, isLoading: postsLoading } = useCollection<Post>(userPostsQuery);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message,
      });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
  };

  return (
    <AppLayout showTopBar={false}>
      <div className="px-4">
        {/* Profile Header */}
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold font-headline">
              {formatUserId(user?.uid)}
            </h2>
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon">
                    <Settings className="h-6 w-6" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="h-6 w-6 text-destructive" />
                </Button>
            </div>
        </div>

        <div className="flex items-center space-x-5 mb-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24">
            <AvatarImage
              src={user?.photoURL || undefined}
              alt={user?.displayName || "User"}
            />
            <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
              {getInitials(user?.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex justify-around text-center">
              <div>
                {postsLoading ? (
                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                    <div className="font-bold text-lg">{posts?.length ?? 0}</div>
                )}
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
              <div>
                <p className="font-bold text-lg">1.2k</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </div>
              <div>
                <p className="font-bold text-lg">345</p>
                <p className="text-muted-foreground">Following</p>
              </div>
          </div>
        </div>


        {/* User Name and Bio */}
        <div className="mb-4">
            <h1 className="font-bold text-base">{user?.displayName}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="mb-4">
            <Button variant="secondary" size="sm" className="w-full">Edit Profile</Button>
        </div>


        {/* Tabs */}
        <div className="flex justify-center border-t">
            <button className="flex-1 text-center py-2 border-t-2 border-primary">
                <Grid3x3 className="mx-auto h-6 w-6 text-primary" />
            </button>
             <button className="flex-1 text-center py-2">
                <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" />
            </button>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-3 gap-1 mt-1">
            {postsLoading && Array.from({length: 6}).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
            ))}
            {posts?.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`}>
                <div className="aspect-square bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              </Link>
            ))}
        </div>
         {!postsLoading && posts?.length === 0 && (
             <div className="col-span-3 text-center py-16">
                <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                <p className="text-muted-foreground">Start sharing your thoughts!</p>
            </div>
        )}
      </div>
    </AppLayout>
  );
}
