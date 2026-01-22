
"use client";

import * as React from "react";
import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, serverTimestamp, setDoc, doc, updateDoc, getDoc, writeBatch, Timestamp } from "firebase/firestore";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import type { Post, QuotedPost, Notification } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";


import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetHeader,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, X, ListOrdered, Plus, Link as LinkIcon, Image as ImageIcon, CalendarClock } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn, getAvatar, formatUserId, formatTimestamp } from "@/lib/utils";
import type { LinkMetadata } from "@/lib/types";
import Image from "next/image";
import { QuotedPostCard } from "@/components/QuotedPostCard";

const pollOptionSchema = z.object({
  option: z.string().min(1, "Option cannot be empty.").max(100, "Option is too long."),
});

const linkMetadataSchema = z.object({
    url: z.string().url(),
    title: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
}).optional();

const quotedPostSchema = z.object({
    id: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    authorAvatar: z.string(),
    content: z.string(),
    timestamp: z.any(),
}).optional();


const baseSchema = z.object({
  content: z.string().max(560, "Post is too long.").optional(),
  commentsAllowed: z.boolean().default(true),
  linkMetadata: linkMetadataSchema,
  quotedPost: quotedPostSchema,
  expiration: z.number().optional(), // duration in seconds
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
]).refine(data => !!data.content || !!data.linkMetadata || !!data.quotedPost, {
    message: "Post content cannot be empty.",
    path: ["content"],
});

const expirationOptions = [
    { label: '30 Minutes', value: 30 * 60 },
    { label: '1 Hour', value: 60 * 60 },
    { label: '6 Hours', value: 6 * 60 * 60 },
    { label: '1 Day', value: 24 * 60 * 60 },
    { label: '7 Days', value: 7 * 24 * 60 * 60 },
];


function LinkPreview({ metadata, onRemove }: { metadata: LinkMetadata, onRemove: () => void }) {
    const getDomainName = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="mt-3 border rounded-lg overflow-hidden relative">
            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 bg-black/50 hover:bg-black/70 text-white hover:text-white rounded-full z-10" onClick={onRemove}>
                <X className="h-4 w-4" />
            </Button>
            {metadata.imageUrl && (
                 <div className="relative aspect-video bg-secondary">
                    <Image
                        src={metadata.imageUrl}
                        alt={metadata.title || 'Link preview'}
                        fill
                        className="object-cover"
                    />
                </div>
            )}
            <div className="p-3 bg-secondary/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{getDomainName(metadata.url)}</p>
                <p className="font-semibold text-sm truncate mt-0.5">{metadata.title || metadata.url}</p>
            </div>
        </div>
    )
}

function PostPageComponent() {
  const [isOpen, setIsOpen] = useState(true);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isExpirationSheetOpen, setIsExpirationSheetOpen] = useState(false);
  const [expirationLabel, setExpirationLabel] = useState("Never");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, firestore } = useFirebase();

  const postId = searchParams.get('postId');
  const quotePostId = searchParams.get('quotePostId');
  const isEditMode = !!postId;

  const quotePostRef = useMemoFirebase(() => {
    if (!quotePostId || !firestore) return null;
    return doc(firestore, 'posts', quotePostId);
  }, [quotePostId, firestore]);
  
  const { data: quotePostData, isLoading: isQuotePostLoading } = useDoc<Post>(quotePostRef);

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: "",
      commentsAllowed: true,
      isPoll: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pollOptions",
  });
  
  useEffect(() => {
    if (isEditMode && firestore && postId) {
      const fetchPostData = async () => {
        const postRef = doc(firestore, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data() as Post;
          
          let expirationInSeconds;
          let currentLabel = 'Never';
          if (postData.expiresAt) {
            expirationInSeconds = (postData.expiresAt.toMillis() - Date.now()) / 1000;
            const matchedOption = expirationOptions.find(opt => Math.abs(opt.value - expirationInSeconds!) < 60); // Allow 1-minute tolerance
            if (matchedOption) {
              currentLabel = matchedOption.label;
            } else {
              currentLabel = 'Custom';
            }
          }

          form.reset({
            content: postData.content,
            commentsAllowed: postData.commentsAllowed,
            isPoll: postData.type === 'poll',
            quotedPost: postData.quotedPost,
            linkMetadata: postData.linkMetadata,
            expiration: expirationInSeconds,
          });
          setExpirationLabel(currentLabel);
        }
      };
      fetchPostData();
    }
  }, [isEditMode, postId, firestore, form]);

  useEffect(() => {
      if (quotePostData) {
          const quotedPostForForm: QuotedPost = {
              id: quotePostData.id,
              authorId: quotePostData.authorId,
              content: quotePostData.content,
              authorName: formatUserId(quotePostData.authorId),
              authorAvatar: getAvatar(quotePostData.authorId),
              timestamp: quotePostData.timestamp,
          }
          form.setValue('quotedPost', quotedPostForForm, { shouldValidate: true });
      }
  }, [quotePostData, form]);


  const isPoll = form.watch("isPoll");
  const linkMetadata = form.watch("linkMetadata");
  const quotedPost = form.watch("quotedPost");

  const avatar = getAvatar(userProfile);
  const isAvatarUrl = avatar.startsWith('http');

  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => router.back(), 300);
    }
  }, [isOpen, router]);

  const handlePaste = async (event: React.ClipboardEvent) => {
    if (linkMetadata) return; // Don't do anything if a link is already attached

    const pastedText = event.clipboardData.getData('text');
    try {
        const url = new URL(pastedText); // This will throw if not a valid URL
        setShowLinkInput(true);
        form.setValue("linkMetadata.url", url.href); // Set the value for the hidden input
        fetchPreview(url.href);
    } catch (error) {
        // Not a valid URL, do nothing
    }
  };

  const fetchPreview = async (url: string) => {
    setIsFetchingPreview(true);
    // In a real app, you would call your AI flow here.
    // For now, we'll simulate a delay and use mock data.
    setTimeout(() => {
        const mockData: LinkMetadata = {
            url: url,
            title: "This is a fetched link title",
            description: "This is a longer description for the link that has been fetched from the website to show a rich preview.",
            imageUrl: `https://picsum.photos/seed/${Math.random()}/1200/630`,
            faviconUrl: `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`
        };
        form.setValue("linkMetadata", mockData, { shouldValidate: true });
        setIsFetchingPreview(false);
        setShowLinkInput(false);
    }, 1500);
  };


  const onSubmit = (values: z.infer<typeof postSchema>) => {
    if (!user || !firestore) return;

    form.trigger();
    const { expiration, ...postValues } = values;

    
    if (isEditMode && postId) {
      const postRef = doc(firestore, `posts`, postId);
      const updatedData: Partial<Post> = {
        content: values.content,
        commentsAllowed: values.commentsAllowed,
        linkMetadata: values.linkMetadata,
        quotedPost: values.quotedPost,
      };

      if (expiration) {
        updatedData.expiresAt = Timestamp.fromMillis(Date.now() + expiration * 1000);
      } else {
        updatedData.expiresAt = undefined;
      }

      if (updatedData.linkMetadata === undefined) {
        delete updatedData.linkMetadata;
      }
      if (updatedData.quotedPost === undefined) {
        delete updatedData.quotedPost;
      }
      if (updatedData.expiresAt === undefined) {
        delete updatedData.expiresAt;
      }

      updateDoc(postRef, updatedData)
        .then(() => {
            form.reset();
            setIsOpen(false);
        })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: postRef.path,
                operation: 'update',
                requestResourceData: updatedData
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    } else {
        // Logic for creating a new post
        const newPostRef = doc(collection(firestore, `posts`));
        
        let type: Post['type'] = 'text';
        if (values.isPoll) {
            type = 'poll';
        } else if (values.quotedPost) {
            type = 'quote';
        }

        const newPostData: any = {
          id: newPostRef.id,
          authorId: user.uid,
          content: values.content,
          timestamp: serverTimestamp(),
          likes: [],
          likeCount: 0,
          commentCount: 0,
          repostCount: 0,
          commentsAllowed: values.commentsAllowed,
          isPinned: false,
          type: type,
          ...(values.linkMetadata && { linkMetadata: values.linkMetadata }),
          ...(values.quotedPost && { quotedPost: values.quotedPost }),
        };

        if (expiration) {
          newPostData.expiresAt = Timestamp.fromMillis(Date.now() + expiration * 1000);
        }

        if (values.isPoll) {
            newPostData.pollOptions = values.pollOptions.map(opt => ({ option: opt.option, votes: 0 }));
            newPostData.voters = {};
        }

        setDoc(newPostRef, newPostData)
          .then(() => {
            if (type === 'quote' && values.quotedPost && values.quotedPost.authorId !== user.uid) {
                const notificationRef = doc(collection(firestore, 'users', values.quotedPost.authorId, 'notifications'));
                const notificationData: Omit<Notification, 'id' | 'timestamp'> = {
                    type: 'quote',
                    postId: values.quotedPost.id,
                    fromUserId: user.uid,
                    activityContent: values.content?.substring(0, 100),
                    read: false,
                };
                setDoc(notificationRef, { ...notificationData, id: notificationRef.id, timestamp: serverTimestamp() }).catch(serverError => {
                    console.error("Failed to create quote notification:", serverError);
                });
            }

            if (userProfile && userProfile.upvotedBy && userProfile.upvotedBy.length > 0) {
              const batch = writeBatch(firestore);
              userProfile.upvotedBy.forEach(followerId => {
                  const notificationRef = doc(collection(firestore, 'users', followerId, 'notifications'));
                  const notificationData: Omit<Notification, 'id' | 'timestamp'> = {
                      type: 'new_post',
                      postId: newPostRef.id,
                      fromUserId: user.uid,
                      activityContent: values.content?.substring(0, 100),
                      read: false,
                  };
                  batch.set(notificationRef, { ...notificationData, id: notificationRef.id, timestamp: serverTimestamp() });
              });
              batch.commit().catch(err => console.error("Failed to fan-out new post notifications:", err));
            }


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
      }
  };
  
  const handlePollToggle = () => {
    const currentIsPoll = form.getValues('isPoll');
    if (!currentIsPoll) {
        // Turning poll ON
        form.setValue('isPoll', true, { shouldValidate: true });
        append({ option: '' });
        append({ option: '' });
    } else {
        // Turning poll OFF
        form.setValue('isPoll', false, { shouldValidate: true });
        remove(); // remove all fields
    }
  };
  
  const handleSelectExpiration = (seconds: number, label: string) => {
    form.setValue('expiration', seconds);
    setExpirationLabel(label);
    setIsExpirationSheetOpen(false);
  }

  const handleClearExpiration = () => {
      form.setValue('expiration', undefined);
      setExpirationLabel('Never');
      setIsExpirationSheetOpen(false);
  }


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className="h-screen flex flex-col p-0 rounded-t-2xl">
        <div className="z-10 flex items-center justify-between p-2 border-b bg-background sticky top-0 h-14">
          <div className="flex items-center gap-2">
            <SheetClose asChild>
                <Button variant="ghost" size="icon">
                    <X className="h-4 w-4" />
                </Button>
            </SheetClose>
            <SheetTitle className="text-base font-bold">{isEditMode ? 'Edit Post' : 'Create Post'}</SheetTitle>
          </div>
          <Button form="post-form" type="submit" disabled={form.formState.isSubmitting} className="rounded-full px-6 font-bold">
            {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditMode ? (
                'Save'
            ) : (
                'Post'
            )}
          </Button>
        </div>
        
        <div className="flex-grow flex flex-col">
            <div className="flex-grow overflow-y-auto px-4">
                <div className="flex items-start space-x-4">
                    <Avatar>
                        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={formatUserId(user?.uid)} />
                        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                    </Avatar>
                     <div className="w-full">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{formatUserId(user?.uid)}</span>
                        </div>
                        <Form {...form}>
                            <form id="post-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="content"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={isPoll ? "Ask a question..." : "What's on your mind?"}
                                                    className="border-none focus-visible:ring-0 !outline-none text-base resize-none -ml-2"
                                                    rows={3}
                                                    onPaste={handlePaste}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {quotedPost && (
                                     <div className="relative">
                                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 bg-black/50 hover:bg-black/70 text-white hover:text-white rounded-full z-10" onClick={() => form.setValue("quotedPost", undefined)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <QuotedPostCard post={quotedPost} />
                                     </div>
                                )}

                                {linkMetadata ? (
                                    <LinkPreview metadata={linkMetadata} onRemove={() => form.setValue("linkMetadata", undefined)} />
                                ) : isFetchingPreview ? (
                                    <div className="border rounded-lg p-4 flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        <span className="ml-2 text-muted-foreground text-sm">Fetching preview...</span>
                                    </div>
                                ) : showLinkInput ? (
                                    <FormField
                                        control={form.control}
                                        name="linkMetadata.url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                     <div className="relative">
                                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input placeholder="https://..." {...field} className="pl-9 bg-secondary" onBlur={(e) => fetchPreview(e.target.value)} />
                                                     </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : null}


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
                                                                    <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} className="rounded-full bg-primary hover:bg-primary/80 text-primary-foreground h-6 w-6">
                                                                        <X className="h-4 w-4" />
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
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({option: ""})} className="w-full">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add option
                                            </Button>
                                        )}
                                        <FormMessage>{form.formState.errors.pollOptions?.root?.message || form.formState.errors.pollOptions?.message}</FormMessage>
                                    </div>
                                 )}
                                 
                                <div className="p-4 border-t bg-background w-full fixed bottom-0 left-0 right-0">
                                    <div className="flex items-center space-x-1">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setShowLinkInput(!showLinkInput)} disabled={!!linkMetadata || isEditMode}>
                                            <LinkIcon className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={handlePollToggle} disabled={isEditMode}>
                                            <ListOrdered className={cn("h-5 w-5 text-muted-foreground", isPoll && "text-primary")} />
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setIsExpirationSheetOpen(true)}>
                                                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground">{expirationLabel}</span>
                                        </div>
                                            <FormField
                                            control={form.control}
                                            name="commentsAllowed"
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2 space-y-0 pl-2">
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
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
         <Sheet open={isExpirationSheetOpen} onOpenChange={setIsExpirationSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="pb-4">
                    <SheetTitle>Post Expiration</SheetTitle>
                    <SheetDescription>The post will be deleted after this duration.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col space-y-2">
                    {expirationOptions.map(opt => (
                        <Button
                            key={opt.value}
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleSelectExpiration(opt.value, opt.label)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                    <Button
                        variant="destructive"
                        className="justify-start"
                        onClick={handleClearExpiration}
                    >
                        Never Expire
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
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
