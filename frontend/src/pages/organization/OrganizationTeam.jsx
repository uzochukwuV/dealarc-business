import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  listOrganizationMembers,
  addOrganizationMember,
  updateOrganizationMember,
  removeOrganizationMember,
} from "@/backend/organisations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { fmtDate } from "@/lib/workspace-utils";

export default function OrganizationTeam() {
  const { org, user: currentUser } = useOutletContext();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ userId: "", role: "MEMBER" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const list = await listOrganizationMembers(org.id);
    setMembers(list);
    return list;
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        toast({ title: "Failed to load team", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [org.id]);

  const toggleSigner = async (m) => {
    try {
      await updateOrganizationMember(org.id, m.id, { isAuthorizedSigner: !m.isAuthorizedSigner });
      await load();
      toast({ title: m.isAuthorizedSigner ? "Signer access revoked" : "Authorized signer enabled" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const setRole = async (m, role) => {
    try {
      await updateOrganizationMember(org.id, m.id, { role });
      await load();
      toast({ title: "Role updated" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!inviteForm.userId.trim()) {
      toast({ title: "Enter a user ID", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await addOrganizationMember(org.id, {
        userId: inviteForm.userId.trim(),
        role: inviteForm.role,
      });
      toast({ title: "Member added", description: inviteForm.userId });
      setInviteOpen(false);
      setInviteForm({ userId: "", role: "MEMBER" });
      await load();
    } catch (err) {
      toast({ title: "Failed to add member", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const removeMember = async (m) => {
    try {
      await removeOrganizationMember(org.id, m.id);
      await load();
      toast({ title: "Member removed" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono-tech text-muted-foreground">ORGANIZATION / TEAM</div>
          <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
            Team members
          </h1>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="h-11 rounded-none bg-primary px-5 hover:bg-primary/90"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add member
        </Button>
      </div>

      <div className="mt-8 border border-foreground/15">
        <div className="grid grid-cols-12 gap-4 border-b border-foreground/15 bg-secondary px-5 py-3 font-mono-tech text-muted-foreground">
          <div className="col-span-4">MEMBER</div>
          <div className="col-span-3">EMAIL</div>
          <div className="col-span-2">ROLE</div>
          <div className="col-span-2">SIGNER</div>
          <div className="col-span-1"></div>
        </div>
        {members.map((m) => {
          const isSelf = m.userId === currentUser?.id;
          const displayName = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId;
          return (
            <div key={m.id} className="grid grid-cols-12 items-center gap-4 border-b border-foreground/10 p-5 last:border-b-0">
              <div className="col-span-12 md:col-span-4">
                <div className="text-sm font-medium text-foreground">
                  {displayName}
                  {isSelf && <span className="ml-2 font-mono text-[10px] text-muted-foreground">(you)</span>}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">{fmtDate(m.joinedAt)}</div>
              </div>
              <div className="col-span-6 md:col-span-3 truncate text-sm text-foreground">{m.email || "—"}</div>
              <div className="col-span-6 md:col-span-2">
                {isSelf ? (
                  <span className="font-mono-tech text-muted-foreground">{m.role}</span>
                ) : (
                  <select
                    value={m.role}
                    onChange={(e) => setRole(m, e.target.value)}
                    className="h-8 rounded-none border border-foreground/20 bg-background px-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="FINANCE">FINANCE</option>
                    <option value="MEMBER">MEMBER</option>
                  </select>
                )}
              </div>
              <div className="col-span-6 md:col-span-2">
                <button
                  onClick={() => !isSelf && toggleSigner(m)}
                  disabled={isSelf}
                  className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    m.isAuthorizedSigner
                      ? "border-[hsl(170,60%,33%)]/30 bg-[hsl(170,100%,95%)] text-[hsl(190,88%,21%)]"
                      : "border-foreground/15 bg-secondary text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  {m.isAuthorizedSigner ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                  {m.isAuthorizedSigner ? "Signer" : "No"}
                </button>
              </div>
              <div className="col-span-12 md:col-span-1 text-right">
                {!isSelf && m.role !== "OWNER" && (
                  <button
                    onClick={() => removeMember(m)}
                    title="Remove member"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={inviteOpen} onOpenChange={(o) => !o && setInviteOpen(false)}>
        <DialogContent className="max-w-md rounded-sm border-foreground/15 bg-background p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-heading text-xl font-medium">Add team member</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add an existing platform user by their user ID. (Email invitations are not yet supported by the backend.)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={invite} className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">USER ID</Label>
              <Input
                value={inviteForm.userId}
                onChange={(e) => setInviteForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="user uuid"
                className="h-11 rounded-none border-foreground/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono-tech text-foreground">ROLE</Label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                className="h-11 w-full rounded-none border border-foreground/20 bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="MEMBER">Member — can participate in workspaces</option>
                <option value="ADMIN">Admin — full access, can manage team</option>
                <option value="FINANCE">Finance — can approve payments</option>
              </select>
            </div>
            <div className="flex justify-end border-t border-foreground/15 pt-4">
              <Button type="submit" disabled={submitting} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Add member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
