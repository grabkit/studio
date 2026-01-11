

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
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
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <SheetContent side="bottom" className="rounded-t-[10px]">
                <SheetHeader className="text-center">
                    <SheetTitle>Report {reportedUserName}?</SheetTitle>
                    <SheetDescription>
                        Your report is anonymous. If someone is in immediate danger, call local emergency services.
                    </SheetDescription>
                </SheetHeader>
                <div className="p-4 space-y-4">
                    <RadioGroup onValueChange={setReason} className="space-y-2 py-2">
                        {reportReasons.map((r) => (
                            <div key={r.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary">
                                <RadioGroupItem value={r.id} id={`report-${r.id}`} />
                                <Label htmlFor={`report-${r.id}`} className="font-normal text-base cursor-pointer">{r.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                    <div className="flex flex-col gap-2">
                         <Button onClick={handleSubmitReport} disabled={!reason || isSubmitting} className="w-full rounded-full">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Report
                        </Button>
                        <SheetClose asChild>
                            <Button variant="outline" className="w-full rounded-full">Cancel</Button>
                        </SheetClose>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
