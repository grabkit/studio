import AppLayout from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function PostPage() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="font-headline text-center">Create a Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg bg-primary/50">
                <Plus className="w-12 h-12 text-primary-foreground"/>
                <p className="mt-4 text-primary-foreground">Post creation feature coming soon!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
