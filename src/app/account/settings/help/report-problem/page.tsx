
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

const reportProblemSchema = z.object({
  category: z.string().min(1, "Please select a category."),
  description: z.string().min(10, "Please provide at least 10 characters.").max(1000, "Description is too long."),
});

export default function ReportProblemPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof reportProblemSchema>>({
        resolver: zodResolver(reportProblemSchema),
        defaultValues: {
            category: "",
            description: "",
        },
    });

    const onSubmit = (values: z.infer<typeof reportProblemSchema>) => {
        setIsSubmitting(true);
        // Simulate an API call
        setTimeout(() => {
            console.log("Problem Report:", values);
            toast({
                title: "Report Submitted",
                description: "Thank you for your feedback. We'll look into it.",
            });
            setIsSubmitting(false);
            router.back();
        }, 1500);
    };

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Report a Problem</h2>
            </div>
            <div className="pt-14 p-4">
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
        </AppLayout>
    )
}
