
"use client";

import AuthForm from "@/components/auth/AuthForm";
import { motion } from "framer-motion";

export default function AuthenticationPage() {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex h-screen w-full flex-col items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-sm">
        <AuthForm />
      </div>
    </motion.div>
  );
}
