import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  listVerificationCases,
  submitVerificationCase,
  listOrganizationDocuments,
  uploadOrganizationDocument,
  organizationDocumentDownloadUrl,
} from "@/backend/organisations";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, ShieldCheck, ShieldAlert, Clock, XCircle, FileWarning } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import VerificationBadge from "@/components/app/VerificationBadge";
import { fmtDate } from "@/lib/workspace-utils";

const STATUS_CONFIG = {
  UNVERIFIED: {
    icon: ShieldAlert,
    label: "Unverified",
    color: "text-muted-foreground",
    desc: "Submit your verification documents to unlock full platform access.",
  },
  PENDING: {
    icon: Clock,
    label: "Under review",
    color: "text-[hsl(35,80%,30%)]",
    desc: "Your documents are being reviewed by our verification team. This typically takes 2–3 business days.",
  },
  VERIFIED: {
    icon: ShieldCheck,
    label: "Verified",
    color: "text-[hsl(190,88%,21%)]",
    desc: "Your organization is verified. You have full access to the network.",
  },
  REJECTED: {
    icon: XCircle,
    label: "Rejected",
    color: "text-destructive",
    desc: "Your verification was not accepted. Please review the notes and resubmit.",
  },
  EXPIRED: {
    icon: FileWarning,
    label: "Expired",
    color: "text-[hsl(35,80%,30%)]",
    desc: "Your verification has expired. Please resubmit your documents.",
  },
};

export default function OrganizationVerification() {
  const { org, reload } = useOutletContext();
  const [cases, setCases] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const status = org?.verificationStatus || "UNVERIFIED";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.UNVERIFIED;
  const StatusIcon = cfg.icon;

  const refresh = async () => {
    const [c, d] = await Promise.all([
      listVerificationCases(org.id).catch(() => []),
      listOrganizationDocuments(org.id).catch(() => []),
    ]);
    setCases(c);
    setDocs(d);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        toast({ title: "Failed to load", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [org.id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitVerificationCase(org.id);
      await refresh();
      await reload();
      toast({ title: "Verification submitted", description: "Your case is now under review." });
    } catch (err) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadOrganizationDocument(org.id, file, "verification");
      await refresh();
      toast({ title: "Document uploaded", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeDoc = async (docId) => {
    // The backend does not expose a DELETE for documents; instead we can no longer
    // revoke from the client. We surface this as a no-op with guidance.
    toast({ title: "Not supported", description: "Document removal is not available in this build." });
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
      <div className="font-mono-tech text-muted-foreground">ORGANIZATION / VERIFICATION</div>
      <h1 className="mt-4 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-tight text-foreground">
        Verification
      </h1>

      {/* Status banner */}
      <div className="mt-8 border border-foreground/15 bg-card p-6">
        <div className="flex items-start gap-4">
          <StatusIcon className={`mt-0.5 h-6 w-6 ${cfg.color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-xl font-medium text-foreground">{cfg.label}</h2>
              <VerificationBadge status={status} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cfg.desc}</p>
          </div>
        </div>
        {status === "UNVERIFIED" && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={submit}
              disabled={submitting}
              className="h-10 rounded-none bg-primary px-5 hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Submit for verification
            </Button>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div className="font-mono-tech text-muted-foreground">SUBMITTED DOCUMENTS</div>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-9 rounded-none bg-primary px-4 text-xs hover:bg-primary/90"
          >
            {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
            Upload document
          </Button>
          <input ref={fileRef} type="file" onChange={upload} className="hidden" accept=".pdf,.png,.jpg,.jpeg" />
        </div>

        {docs.length === 0 ? (
          <div className="mt-3 border border-foreground/15 bg-card py-16 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-mono-tech text-muted-foreground">NO DOCUMENTS SUBMITTED</p>
          </div>
        ) : (
          <div className="mt-3 border border-foreground/15">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-4 border-b border-foreground/10 p-4 last:border-b-0">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-mono text-xs text-foreground">{doc.docType || "verification"}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {doc.ipfsCid ? `${doc.ipfsCid.slice(0, 12)}…` : doc.id}
                      {doc.createdAt ? ` · ${fmtDate(doc.createdAt)}` : ""}
                    </div>
                  </div>
                </div>
                <a
                  href={organizationDocumentDownloadUrl(org.id, doc.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  DOWNLOAD
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification case history */}
      {cases.length > 0 && (
        <div className="mt-8">
          <div className="font-mono-tech text-muted-foreground">VERIFICATION HISTORY</div>
          <div className="mt-3 space-y-px border border-foreground/15">
            {cases.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-card p-4">
                <div>
                  <div className="font-mono text-xs text-foreground">CASE {c.id.slice(0, 8)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {c.submittedAt ? fmtDate(c.submittedAt) : ""}
                    {c.decision ? ` · ${c.decision}` : ""}
                  </div>
                </div>
                <span className="font-mono-tech text-[11px] text-muted-foreground">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
