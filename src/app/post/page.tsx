
"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Loader2, X, Trash2, Plus } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const pollOptionSchema = z.object({
  option: z.string().min(1, "Option cannot be empty.").max(80, "Option is too long."),
});

const postSchema = z.object({
  type: z.enum(["text", "poll"]).default("text"),
  content: z.string().min(1, "Post cannot be empty.").max(280, "Post cannot exceed 280 characters."),
  commentsAllowed: z.boolean().default(true),
  pollOptions: z.array(pollOptionSchema).optional(),
}).refine(data => {
    if (data.type === 'poll') {
        return data.pollOptions && data.pollOptions.length >= 2;
    }
    return true;
}, {
    message: "A poll must have at least 2 options.",
    path: ["pollOptions"],
}).refine(data => {
    if (data.type === 'poll') {
        return data.pollOptions && data.pollOptions.every(p => p.option.length > 0);
    }
    return true;
}, {
    message: "All poll options must be filled.",
    path: ["pollOptions"],
});

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
}

function PostPageComponent() {
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { firestore } = useFirebase();

  const repostContent = searchParams.get('content');

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      type: "text",
      content: "",
      commentsAllowed: true,
      pollOptions: [{ option: "" }, { option: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pollOptions",
  });

  const postType = form.watch("type");

  useEffect(() => {
    if (repostContent) {
      form.setValue('content', decodeURIComponent(repostContent));
      form.setValue('type', 'text');
    }
  }, [repostContent, form]);

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
      type: values.type,
      timestamp: serverTimestamp(),
      likes: [],
      likeCount: 0,
      commentCount: 0,
      commentsAllowed: values.commentsAllowed,
      ...(values.type === 'poll' && {
          pollOptions: values.pollOptions?.map(opt => ({ option: opt.option, votes: 0 })),
          voters: {}
      })
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
        <div className="z-10 flex items-center gap-2 p-2 border-b bg-background sticky top-0 h-14">
          <SheetClose asChild>
            <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
            </Button>
          </SheetClose>
          <SheetTitle className="text-base font-bold">Create Post</SheetTitle>
          <SheetDescription className="sr-only">Create a new post by writing content. You can also disable replies before publishing.</SheetDescription>
        </div>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow flex flex-col pt-14">
                <div className="flex-grow overflow-y-auto px-4 pb-4 pt-[2px]">
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
                                            placeholder={postType === 'poll' ? "Ask a question..." : "Start a new thread..."}
                                            className="border-none focus-visible:ring-0 !outline-none text-base resize-none -ml-2"
                                            rows={postType === 'poll' ? 2 : 5}
                                            {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                             />
                        </div>
                    </div>

                    <Tabs
                        value={postType}
                        onValueChange={(value) => form.setValue('type', value as "text" | "poll")}
                        className="w-full mt-4"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="text">Thread</TabsTrigger>
                            <TabsTrigger value="poll">Poll</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text"></TabsContent>
                        <TabsContent value="poll">
                            <div className="space-y-3 pt-4">
                                {fields.map((field, index) => (
                                     <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`pollOptions.${index}.option`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Input placeholder={`Option ${index + 1}`} {...field} />
                                                    <Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                ))}
                                {fields.length < 4 && (
                                    <Button variant="outline" className="w-full" onClick={() => append({ option: "" })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add option
                                    </Button>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-4 border-t bg-background w-full">
                    <div className="flex items-center justify-between">
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

export default function PostPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PostPageComponent />
    </Suspense>
  );
}
