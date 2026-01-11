
"use client";

import AuthForm from "@/components/auth/AuthForm";
import { motion } from "framer-motion";

export default function AuthenticationPage() {
  return (
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-screen w-full flex-col items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-sm">
        <AuthForm />
      </div>
    </motion.div>
  );
}
