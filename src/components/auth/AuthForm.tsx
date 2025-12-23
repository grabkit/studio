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
            const newUser: UserType = {
                id: user.uid,
                name: values.name,
                email: values.email,
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
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast({ variant: "destructive", title: "Sign Up Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);
    try {
        await sendPasswordResetEmail(auth, values.email);
        toast({ title: "Password Reset Email Sent", description: "Check your inbox for password reset instructions." });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setLoading(false);
    }
  };
  
  const toggleAuthMode = () => {
    setAuthMode(prevMode => (prevMode === 'login' ? 'signup' : 'login'));
    form.reset(); // Reset form state and errors on mode switch
  }


  return (
    <div className="w-full">
        <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image 
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png" 
                alt="Blur Logo"
                width={120}
                height={40}
              />
            </div>
            <p className="text-muted-foreground mt-2">
              {authMode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to get started.'}
            </p>
        </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {authMode === 'signup' && (
               <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input placeholder="Name" {...field} className="h-12 text-base pl-10 rounded-full" />
                            </div>
                        </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="email" placeholder="Email" {...field} className="h-12 text-base pl-10 rounded-full" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="password" placeholder="Password" {...field} className="h-12 text-base pl-10 rounded-full" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {authMode === 'signup' && (
                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md py-4">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                                I agree to our <Button variant="link" className="p-0 h-auto">Terms and Conditions</Button>.
                            </FormLabel>
                             <FormMessage />
                        </div>
                    </FormItem>
                  )}
                />
            )}

            <Button type="submit" size="lg" className="w-full font-headline text-lg rounded-full pt-6 pb-6" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </Button>
        </form>
      </Form>
      
       <div className="text-center mt-6">
            <button onClick={toggleAuthMode} className="text-sm">
                <span className="text-muted-foreground">
                    {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                </span>
                <span className="font-semibold text-primary hover:underline">
                    {authMode === 'login' ? "Sign Up" : "Login"}
                </span>
            </button>
       </div>

        <div className={cn("text-center mt-2", authMode === 'signup' && 'hidden')}>
            <ForgotPasswordDialog loading={loading} form={forgotPasswordForm} onSubmit={onForgotPassword} />
        </div>
    </div>
  );
}

function ForgotPasswordDialog({form, onSubmit, loading}: {form: UseFormReturn<any>, onSubmit: any, loading: boolean}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="link" className="text-sm p-0 h-auto font-semibold">Forgot Password?</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline">Forgot Password?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Enter your email address and we'll send you a link to reset your password.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Reset Link
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
