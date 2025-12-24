
"use client";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import type { Report } from "@/lib/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Loader2 } from "lucide-react";

const reportReasons = [
    { id: "spam", label: "Spam or Misleading" },
    { id: "harassment", label: "Harassment or Hate Speech" },
    { id: "impersonation", label: "Impersonation" },
    { id: "other", label: "Other" },
];

export function ReportDialog({ children, reportedUserId, reportedUserName }: { children: React.ReactNode, reportedUserId: string, reportedUserName: string }) {
    const { firestore, user: currentUser } = useFirebase();
    const { toast } = useToast();
    const [reason, setReason] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmitReport = async () => {
        if (!currentUser || !firestore) {
            toast({ variant: "destructive", title: "You must be logged in to report." });
            return;
        }
        if (!reason) {
            toast({ variant: "destructive", title: "Please select a reason." });
            return;
        }
        
        setIsSubmitting(true);

        const reportRef = doc(collection(firestore, 'reports'));

        const newReport: Report = {
            id: reportRef.id,
            reporterUserId: currentUser.uid,
            reportedUserId: reportedUserId,
            reason: reason,
            timestamp: serverTimestamp(),
            status: 'pending',
        };

        try {
            await setDoc(reportRef, newReport);
            toast({
                title: "Report Submitted",
                description: `Thank you for helping keep the community safe.`,
            });
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: reportRef.path,
                operation: 'create',
                requestResourceData: newReport,
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSubmitting(false);
            setIsOpen(false);
            setReason(null);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                {children}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Report {reportedUserName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your report is anonymous. If someone is in immediate danger, call local emergency services.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <RadioGroup onValueChange={setReason} className="space-y-2 py-2">
                     {reportReasons.map((r) => (
                        <div key={r.id} className="flex items-center space-x-2">
                             <RadioGroupItem value={r.id} id={r.id} />
                             <Label htmlFor={r.id} className="font-normal">{r.label}</Label>
                        </div>
                    ))}
                </RadioGroup>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button onClick={handleSubmitReport} disabled={!reason || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Report
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
