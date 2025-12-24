"use client";

import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useAuth as useFirebaseAuth, sendPasswordResetEmail } from "firebase/auth";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { cn, getInitials } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { doc, setDoc } from "firebase/firestore";
import type { User as UserType } from "@/lib/types";

const signUpSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions." }),
  }),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const forgotPasswordSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email." }),
});


// Combined schema for the single form
const authSchema = z.object({
  name: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  terms: z.boolean().optional(),
});


export default function AuthForm() {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
  });
    
  const forgotPasswordForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (values: z.infer<typeof authSchema>) => {
    if (authMode === 'login') {
      const result = loginSchema.safeParse(values);
      if (!result.success) {
        // Manually set form errors
        result.error.issues.forEach(issue => {
          form.setError(issue.path[0] as keyof typeof values, { message: issue.message });
        });
        return;
      }
      await onLogin(result.data);
    } else { // signup
      const result = signUpSchema.safeParse(values);
       if (!result.success) {
        result.error.issues.forEach(issue => {
          form.setError(issue.path[0] as keyof typeof values, { message: issue.message });
        });
        return;
      }
      await onSignUp(result.data);
    }
  };


  const onLogin = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      router.push("/home");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      
      // After creating the user in Auth, create their profile document in Firestore.
      if (user && firestore) {
        try {
            await updateProfile(user, { displayName: values.name });
            
            const userDocRef = doc(firestore, "users", user.uid);
            const newUser: Omit<UserType, 'upvotes' | 'upvotedBy'> = {
                id: user.uid,
                name: values.name,
                email: values.email,
                status: 'active'
            };
            // This setDoc creates the user document in the 'users' collection.
            await setDoc(userDocRef, newUser);
        } catch (firestoreError: any) {
            // This is the critical change. If Firestore write fails, inform the user.
            console.error("Firestore profile creation error:", firestoreError);
            toast({ 
                variant: "destructive", 
                title: "Profile Creation Failed", 
                description: "Your account was created, but we couldn't save your profile due to a temporary issue (the database limit might be reached). Please try logging in again later.",
                duration: 9000,
            });
             // We still proceed to the home page, as the auth account is created.
            router.push("/home");
            return;
        }
      }

      router.push("/home");
    } catch (error: any