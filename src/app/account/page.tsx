"use client";

import AppLayout from "@/components/AppLayout";
import { useUser, useFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "firebase/auth";

export default function AccountPage() {
  const { user } = useUser();
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message,
      });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
              <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
                {getInitials(user?.displayName)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="font-headline text-3xl">{formatUserId(user?.uid)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4 p-3 bg-secondary rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-body text-foreground truncate">{user?.email || 'No email provided'}</span>
            </div>
             <div className="flex items-center space-x-4 p-3 bg-secondary rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-body text-foreground truncate">{user?.displayName || 'No name provided'}</span>
            </div>
            <div className="flex items-center space-x-4 p-3 bg-secondary rounded-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-mono text-muted-foreground truncate">{formatUserId(user?.uid)}</span>
            </div>
            <Button variant="destructive" className="w-full font-headline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
