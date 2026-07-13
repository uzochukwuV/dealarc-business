import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="Password reset is not available in this backend yet."
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      <div className="space-y-4 text-sm text-foreground">
        <p>If you need access, sign in with your existing account or ask an administrator to create one.</p>
        <Button asChild className="w-full h-12 font-medium">
          <Link to="/login">Back to log in</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
