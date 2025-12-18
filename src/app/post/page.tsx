
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
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Loader2, X } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const postSchema = z.object({
  content: z.string().min(1, "Post cannot be empty.").max(280, "Post cannot exceed 280 characters."),
  commentsAllowed: z.boolean().default(true),
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
      commentsAllowed: true,
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
      commentsAllowed: values.commentsAllowed,
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
        <div className="sticky top-0 z-10 flex items-center gap-2 p-2 border-b bg-background h-14">
          <SheetClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-5 w-5" />
            </Button>
          </SheetClose>
          <SheetTitle className="text-base font-bold">Create Post</SheetTitle>
          <SheetDescription className="sr-only">Create a new post by filling out the form below.</SheetDescription>
        </div>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow flex flex-col pt-14">
                <div className="flex-grow px-4 pb-4 overflow-y-auto">
                    <div className="flex items-start space-x-4">
                        <Avatar>
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="w-full">
                            <span className="font-semibold text-sm">{formatUserId(user?.uid)}</span>
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
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-background">
                    <div className="flex items-center justify-between">
                         <FormField
                            control={form.control}
                            name="commentsAllowed"
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                     <Switch
                                        id="comments-allowed"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    <Label htmlFor="comments-allowed" className="text-sm text-muted-foreground">
                                        {field.value ? "Replies are on" : "Replies are off"}
                                    </Label>
                                </FormItem>
                            )}
                            />
                        <Button type="submit" disabled={isSubmitting} className="rounded-full w-32">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
                        </Button>
                    </div>
                </div>
            </form>
        </Form>

      </SheetContent>
    </Sheet>
  );
}
