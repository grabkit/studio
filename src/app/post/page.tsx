
"use client";

import * as React from "react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, X, ListOrdered, Plus, Trash2 } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn, getInitials } from "@/lib/utils";

const pollOptionSchema = z.object({
  option: z.string().min(1, "Option cannot be empty.").max(100, "Option is too long."),
});

// Base schema for common fields
const baseSchema = z.object({
  content: z.string().min(1, "Post content cannot be empty.").max(560, "Post is too long."),
  commentsAllowed: z.boolean().default(true),
});

// Schema for a standard text post
const textPostSchema = baseSchema.extend({
  isPoll: z.literal(false),
});

// Schema for a poll post
const pollPostSchema = baseSchema.extend({
  isPoll: z.literal(true),
  pollOptions: z
    .array(pollOptionSchema)
    .min(2, "A poll must have at least 2 options.")
    .max(4, "A poll can have at most 4 options."),
});

// Use a discriminated union to validate based on the `isPoll` flag
const postSchema = z.discriminatedUnion("isPoll", [
  textPostSchema,
  pollPostSchema,
]);


const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
}

function PostPageComponent() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { firestore } = useFirebase();

  const repostContent = searchParams.get('content') || "";


  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: repostContent ? decodeURIComponent(repostContent) : "",
      commentsAllowed: true,
      isPoll: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pollOptions",
  });

  const isPoll = form.watch("isPoll");

  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => router.back(), 300);
    }
  }, [isOpen, router]);

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    if (!user || !firestore) return;

    form.trigger();
    
    const postsColRef = collection(firestore, `posts`);
    const newPostRef = doc(postsColRef);
    
    const newPostData: any = {
      id: newPostRef.id,
      authorId: user.uid,
      content: values.content,
      timestamp: serverTimestamp(),
      likes: [],
      likeCount: 0,
      commentCount: 0,
      commentsAllowed: values.commentsAllowed,
      type: values.isPoll ? 'poll' : 'text',
    };

    if (values.isPoll) {
        newPostData.pollOptions = values.pollOptions.map(opt => ({ option: opt.option, votes: 0 }));
        newPostData.voters = {};
    }

    setDoc(newPostRef, newPostData)
      .then(() => {
        form.reset();
        setIsOpen(false);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: newPostRef.path,
            operation: 'create',
            requestResourceData: newPostData
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        // No need for isSubmitting state, react-hook-form provides it
      });
  };


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className="h-screen flex flex-col p-0">
        <div className="z-10 flex items-center gap-2 p-2 border-b bg-background sticky top-0 h-14">
          <SheetClose asChild>
            <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
            </Button>
          </SheetClose>
          <SheetTitle className="text-base font-bold">Create Post</SheetTitle>
          <SheetDescription className="sr-only">Create a new post by writing content. You can also disable replies before publishing.</SheetDescription>
        </div>
        
        <div className="flex-grow flex flex-col pt-14">
            <div className="flex-grow overflow-y-auto px-4 pb-4 pt-[2px]">
                <div className="flex items-start space-x-4">
                    <Avatar>
                        <AvatarImage src={user?.photoURL || undefined} />
                        <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                    </Avatar>
                     <div className="w-full">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{formatUserId(user?.uid)}</span>
                        </div>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={isPoll ? "Ask a question..." : "Start a new thread..."}
                                                    className="border-none focus-visible:ring-0 !outline-none text-base resize-none -ml-2"
                                                    rows={3}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                 {isPoll && (
                                    <div className="space-y-2 mt-4">
                                        {fields.map((field, index) => (
                                            <FormField
                                                key={field.id}
                                                control={form.control}
                                                name={`pollOptions.${index}.option`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <div className="flex items-center gap-2">
                                                                <Input placeholder={`Option ${index + 1}`} {...field} className="bg-secondary"/>
                                                                {fields.length > 2 && (
                                                                    <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                        {fields.length < 4 && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({option: ""})}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add option
                                            </Button>
                                        )}
                                        <FormMessage>{form.formState.errors.pollOptions?.root?.message || form.formState.errors.pollOptions?.message}</FormMessage>
                                    </div>
                                 )}
                                 
                                <div className="p-4 border-t bg-background w-full fixed bottom-0 left-0 right-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => form.setValue('isPoll', !isPoll, { shouldValidate: true })}>
                                                <ListOrdered className={cn("h-5 w-5 text-muted-foreground", isPoll && "text-primary")} />
                                            </Button>
                                             <FormField
                                                control={form.control}
                                                name="commentsAllowed"
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                         <Switch
                                                            id="comments-allowed"
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                        <Label htmlFor="comments-allowed" className="text-sm">
                                                            Replies
                                                        </Label>
                                                    </FormItem>
                                                )}
                                                />
                                        </div>
                                        <Button type="submit" disabled={form.formState.isSubmitting} className="rounded-full w-32">
                                            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function PostPage() {
  return (
    <Suspense>
      <PostPageComponent />
    </Suspense>
  );
}
