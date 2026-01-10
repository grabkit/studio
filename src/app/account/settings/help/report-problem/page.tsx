
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import type { ProblemReport } from "@/lib/types";
import { motion } from "framer-motion";


const reportProblemSchema = z.object({
  category: z.string().min(1, "Please select a category."),
  description: z.string().min(10, "Please provide at least 10 characters.").max(1000, "Description is too long."),
});

export default function ReportProblemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, user } = useFirebase();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof reportProblemSchema>>({
        resolver: zodResolver(reportProblemSchema),
        defaultValues: {
            category: "",
            description: "",
        },
    });

    const onSubmit = async (values: z.infer<typeof reportProblemSchema>) => {
        if (!firestore || !user) {
            toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to submit a report." });
            return;
        }
        setIsSubmitting(true);
        
        const reportRef = doc(collection(firestore, "problemReports"));
        const reportData: ProblemReport = {
            id: reportRef.id,
            reporterUserId: user.uid,
            category: values.category,
            description: values.description,
            timestamp: serverTimestamp(),
        };

        try {
            await setDoc(reportRef, reportData);
            toast({
                title: "Report Submitted",
                description: "Thank you for your feedback. We'll look into it.",
            });
            router.back();
        } catch (error) {
            console.error("Failed to submit problem report:", error);
            const permissionError = new FirestorePermissionError({
                path: reportRef.path,
                operation: 'create',
                requestResourceData: reportData,
            });
            errorEmitter.emit('permission-error', permissionError);
             toast({
                variant: "destructive",
                title: "Submission Failed",
                description: "There was an error submitting your report. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Report a Problem</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="p-4 h-full overflow-y-auto">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>What's the problem about?</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="general">General Feedback</SelectItem>
                                                <SelectItem value="bug">Bug or Technical Issue</SelectItem>
                                                <SelectItem value="performance">Performance Problem</SelectItem>
                                                <SelectItem value="feature_request">Feature Request</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Can you explain what happened?</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={6}
                                                placeholder="Briefly explain what happened or what's not working."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit
                            </Button>
                        </form>
                    </Form>
                </div>
            </motion.div>
        </AppLayout>
    )
}
