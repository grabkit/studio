import AuthForm from "@/components/auth/AuthForm";

export default function AuthenticationPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <AuthForm />
      </div>
    </div>
  );
}
