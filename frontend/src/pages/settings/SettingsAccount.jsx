import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, Lock, KeyRound, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function SettingsAccount() {
  const { user } = useOutletContext();
  // The backend user model (GET /auth/me) is { id, email, name, createdAt }.
  // Two-factor authentication is not yet configurable server-side, so the toggle
  // is presented as read-only / not-available rather than a silent failed write.
  const twoFA = false;

  return (
    <div className="mx-auto max-w-[700px] px-6 py-12">
      <div className="font-mono-tech text-muted-foreground">SETTINGS / ACCOUNT</div>
      <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
        Account
      </h1>

      {/* Profile */}
      <div className="mt-8 border border-foreground/15 bg-card p-6">
        <h2 className="font-heading text-lg font-medium text-foreground">Personal profile</h2>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label className="font-mono-tech text-foreground">FULL NAME</Label>
            <Input value={user?.name || ""} disabled className="rounded-none border-foreground/20 bg-secondary" />
            <p className="text-xs text-muted-foreground">Name is set during registration and cannot be changed here.</p>
          </div>
          <div className="space-y-2">
            <Label className="font-mono-tech text-foreground">EMAIL</Label>
            <div className="flex h-11 items-center gap-2 rounded-none border border-foreground/20 bg-secondary px-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="mt-px border border-foreground/15 bg-card p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-heading text-lg font-medium text-foreground">Security</h2>
        </div>
        <div className="mt-5 space-y-px">
          {/* 2FA */}
          <div className="flex items-center justify-between border border-foreground/10 bg-background p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">Two-factor authentication</div>
                <p className="text-xs text-muted-foreground">
                  Not yet configurable — the backend does not store 2FA state. Authentication is handled by the platform identity provider.
                </p>
              </div>
            </div>
            <Switch checked={twoFA} disabled />
          </div>

          {/* Password */}
          <div className="flex items-center justify-between border border-foreground/10 bg-background p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">Password</div>
                <p className="text-xs text-muted-foreground">Change your account password via the reset flow.</p>
              </div>
            </div>
            <a
              href="/forgot-password"
              className="border border-foreground/25 px-4 py-2 text-sm text-foreground transition-colors hover:bg-foreground/5"
            >
              Change password
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
