
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
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { cn, getAvatar, getFormattedUserIdString } from "@/lib/utils.tsx";
import { Checkbox } from "@/components/ui/checkbox";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User as UserType } from "@/lib/types";
import { defaultAvatars } from "@/lib/avatars";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from "@/components/ui/sheet";

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
      
      if (user && firestore) {
        try {
            await updateProfile(user, { displayName: values.name });
            
            const userDocRef = doc(firestore, "users", user.uid);
            
            const username = getFormattedUserIdString(user.uid).toLowerCase();

            const newUser: Omit<UserType, 'upvotes' | 'upvotedBy' > = {
                id: user.uid,
                name: values.name,
                username: username,
                email: values.email,
                createdAt: serverTimestamp(),
                status: 'active',
                lastReadTimestamps: {},
                bio: "Hey there! I’m using Blur.",
            };
            await setDoc(userDocRef, newUser, { merge: true });
        } catch (firestoreError: any) {
            console.error("Firestore profile creation error:", firestoreError);
            toast({ 
                variant: "destructive", 
                title: "Profile Creation Failed", 
                description: "Your account was created, but we couldn't save your profile. Please try logging in again later.",
                duration: 9000,
            });
            // still navigate to home as auth user was created
            router.push("/home");
            return;
        }
      }

      router.push("/home");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sign Up Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (values: z.infer<typeof forgotPasswordSchema>) => {
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: "Password Reset Email Sent",
        description: "Check your inbox for a link to reset your password.",
      });
      return true; // Indicate success to close dialog
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: error.message,
      });
      return false; // Indicate failure
    }
  };

  return (
    <div className="w-full space-y-6">
        <div className="text-center">
            <div className="flex justify-center mb-4">
                <div className="dark:hidden">
                    <Image
                        src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png"
                        alt="Blur Logo"
                        width={80}
                        height={26}
                    />
                </div>
                <div className="hidden dark:block">
                    <Image
                        src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi6D6Qy-Z4uf0bgTdhcmekuXrwq7YSU5g8a9bmMVwbjotQ6VNa8NHuFnKjytbRlJb5_g_mqhMrrFmXPd_6W9aeFlItcwiIYjYhzorTAMCPvEBiipvksoQmvxEMmc4-CkvHEQxiO-DGiK4uGIS9nxKTFeu29sutuw3TD-T81opk0NRfGqIkdnrxd1nsU1Nbd/s0/blur%20text%20logo%20darktheme.png"
                        alt="Blur Logo"
                        width={80}
                        height={26}
                    />
                </div>
            </div>
            <h1 className="text-2xl font-headline mt-4">
                {authMode === "login" ? "Welcome Back" : "Create an Account"}
            </h1>
             <p className="text-sm text-muted-foreground">
                {authMode === 'login' ? 'Sign in to continue your anonymous journey.' : 'Join the community to share your thoughts.'}
            </p>
        </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-4">
          {authMode === "signup" && (
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Name</FormLabel>
                  <FormControl>
                     <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Name" {...field} className="pl-10 rounded-full" />
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
                <FormLabel className="sr-only">Email</FormLabel>
                <FormControl>
                   <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="email" placeholder="Email" {...field} className="pl-10 rounded-full" />
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
                <FormLabel className="sr-only">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input type="password" placeholder="Password" {...field} className="pl-10 rounded-full" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

           {authMode === "signup" && (
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal text-muted-foreground">
                      I agree to the{" "}
                      <Button variant="link" type="button" className="p-0 h-auto text-sm">Terms of Service</Button>
                      {" & "}
                      <Button variant="link" type="button" className="p-0 h-auto text-sm">Privacy Policy</Button>.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          )}

          <Button type="submit" className="w-full rounded-full font-bold" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {authMode === "login" ? "Login" : "Sign Up"}
          </Button>
        </form>
      </Form>

       <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                OR
                </span>
            </div>
        </div>

        <div className="text-center text-sm">
            {authMode === "login" ? (
                <div>
                    <div className="mb-2">
                        {"Don't have an account? "}
                        <Button variant="link" onClick={() => { setAuthMode("signup"); form.reset(); }} className="p-0 h-auto font-bold">
                            Sign Up
                        </Button>
                    </div>
                    <div>
                        <ForgotPasswordSheet form={forgotPasswordForm} handlePasswordReset={handlePasswordReset} />
                    </div>
                </div>
            ) : (
                <div className="mb-2">
                    {"Already have an account? "}
                    <Button variant="link" onClick={() => { setAuthMode("login"); form.reset(); }} className="p-0 h-auto font-bold">
                        Login
                    </Button>
                </div>
            )}
        </div>
    </div>
  );
}


function ForgotPasswordSheet({form, handlePasswordReset}: {form: UseFormReturn<any>, handlePasswordReset: (values: any) => Promise<boolean>}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true);
    const success = await handlePasswordReset(values);
    setLoading(false);
    if (success) {
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="link" className="p-0 h-auto">Forgot Password?</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-[10px]">
        <SheetHeader className="text-center">
          <SheetTitle>Forgot Password?</SheetTitle>
          <SheetDescription>
            Enter your email address and we'll send you a link to reset your password.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                            <Input placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="flex flex-col gap-2 pt-2">
                    <Button type="submit" disabled={loading} className="w-full rounded-full">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Reset Link
                    </Button>
                    <SheetClose asChild>
                         <Button type="button" variant="outline" className="w-full rounded-full">Cancel</Button>
                    </SheetClose>
                </div>
            </form>
        </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

    