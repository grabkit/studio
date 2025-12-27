
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updateEmail } from "firebase/auth";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(50),
  email: z.string().email("Please enter a valid email."),
  bio: z.string().max(160, "Bio cannot be longer than 160 characters.").optional(),
  website: z.string().url("Please enter a valid URL.").or(z.literal("")).optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say", ""]),
});


export default function EditProfilePage() {
    const router = useRouter();
    const { user: authUser, userProfile, firestore, auth } = useFirebase();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof profileSchema>>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: userProfile?.name || "",
            email: authUser?.email || "",
            bio: userProfile?.bio || "",
            website: userProfile?.website || "",
            gender: userProfile?.gender || "",
        },
    });

    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };

    const onSubmit = async (values: z.infer<typeof profileSchema>) => {
        if (!authUser || !firestore || !auth) {
            toast({ variant: "destructive", title: "You must be logged in to update your profile." });
            return;
        }

        const userDocRef = doc(firestore, "users", authUser.uid);
        const { email, ...profileData } = values;

        try {
            // Update email in Firebase Auth if it has changed
            if (email && email !== authUser.email) {
                await updateEmail(authUser, email);
            }

            // Update profile data in Firestore
            await updateDoc(userDocRef, profileData);

            toast({ title: "Profile Updated", description: "Your changes have been saved." });
            router.back();
        } catch (error: any) {
            console.error("Error updating profile:", error);
             if (error.code === 'auth/requires-recent-login') {
                 toast({ 
                    variant: "destructive", 
                    title: "Authentication Error", 
                    description: "Changing your email is a sensitive action. Please log out and log back in before trying again." 
                });
            } else {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: values,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: "destructive", title: "Error", description: "Could not update your profile." });
            }
        }
    };


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" type="button" onClick={() => router.back()}>
                                <ArrowLeft />
                            </Button>
                            <h2 className="text-lg font-bold ml-2">Edit Profile</h2>
                        </div>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                             {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </div>

                    <div className="pt-20 px-4 space-y-6">
                        <div className="flex justify-center">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={authUser?.photoURL || undefined} alt={userProfile?.name} />
                                <AvatarFallback className="text-4xl">
                                    {getInitials(userProfile?.name)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        
                        <div className="space-y-4">
                             <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />

                             <FormItem>
                                <FormLabel>Username</FormLabel>
                                <Input value={formatUserId(authUser?.uid)} disabled />
                            </FormItem>

                             <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                             <FormField
                                control={form.control}
                                name="bio"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Bio</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Links</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://your-website.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Gender</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your gender" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>

                    </div>
                </form>
            </Form>
        </AppLayout>
    );
}
