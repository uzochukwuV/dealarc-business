import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  return (
    <AuthLayout
      icon={Lock}
      title="New password"
      subtitle="Password reset is not supported by this backend."
    >
      <div className="space-y-4 text-sm text-foreground">
        <p>If you cannot sign in, ask an administrator to reissue access.</p>
        <Button asChild className="w-full h-12 font-medium">
          <Link to="/login">Back to log in</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
