import AuthForm from "@/components/auth/AuthForm";

export default function AuthenticationPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <AuthForm />
      </div>
    </div>
  );
}
