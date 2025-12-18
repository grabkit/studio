"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { useFirebase, useUser } from "@/firebase";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Loader2, X } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const postSchema = z.object({
  content: z.string().min(1, "Post cannot be empty.").max(280, "Post cannot exceed 280 characters."),
});

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
}

export default function PostPage() {
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const { firestore } = useFirebase();

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: "",
    },
  });

  useEffect(() => {
    if (!isOpen) {
      router.back();
    }
  }, [isOpen, router]);

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    if (!user || !firestore) return;

    setIsSubmitting(true);
    
    const postsColRef = collection(firestore, `posts`);
    const newPostRef = doc(postsColRef);

    const newPost = {
      id: newPostRef.id,
      authorId: user.uid,
      content: values.content,
      timestamp: serverTimestamp(),
      likes: [],
      likeCount: 0,
      commentCount: 0,
    };

    setDoc(newPostRef, newPost)
      .then(() => {
        form.reset();
        setIsOpen(false);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: newPostRef.path,
            operation: 'create',
            requestResourceData: newPost
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Error creating post:", serverError);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className="h-screen flex flex-col p-0">
        <div className="sticky top-0 z-10 flex flex-row items-center justify-between p-4 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-bold">Create Post</h2>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting} size="sm" className="w-24">
             {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
          </Button>
        </div>
        <div className="flex-grow p-4 overflow-y-auto">
            <div className="flex items-start space-x-4">
                <Avatar>
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="w-full">
                    <span className="font-semibold text-sm">{formatUserId(user?.uid)}</span>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
                            <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea
                                        placeholder="Start a new thread..."
                                        className="border-none focus-visible:ring-0 !outline-none text-base resize-none -ml-2"
                                        rows={5}
                                        {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                        </form>
                    </Form>
                </div>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
