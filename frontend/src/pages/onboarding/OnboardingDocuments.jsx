import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveOrganizationId, getCurrentUser, getOrganization, submitVerificationCase, uploadOrganizationDocument } from "@/lib/backend-auth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, FileCheck2, UploadCloud, Lock, Check } from "lucide-react";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

const DOC_TYPES = [
  { key: "REGISTRATION_CERT", label: "Registration certificate" },
  { key: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { key: "REPRESENTATIVE_ID", label: "Representative ID" },
];

const PHASE_LABEL = { uploading: "Uploading", stored: "Stored" };

export default function OnboardingDocuments() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [docs, setDocs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timers = useRef({});

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const activeOrgId = getActiveOrganizationId();
        if (!activeOrgId) {
          navigate("/onboarding/organization", { replace: true });
          return;
        }

        const organization = await getOrganization(activeOrgId);
        setOrg(organization);

        if (organization.verificationStatus === "PENDING") {
          navigate("/onboarding/pending", { replace: true });
        }
        if (organization.verificationStatus === "VERIFIED") {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        navigate("/onboarding/organization", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const setPhaseLater = (docType) => {
    timers.current[docType] = setTimeout(() => {
      setDocs((current) => ({ ...current, [docType]: { ...current[docType], phase: "stored" } }));
    }, 300);
  };

  const handleFile = async (docType, file) => {
    if (!file || !org) return;
    setDocs((current) => ({ ...current, [docType]: { file, phase: "uploading" } }));
    setError("");
    try {
      await uploadOrganizationDocument(org.id, file, docType);
      setDocs((current) => ({ ...current, [docType]: { ...current[docType], phase: "stored" } }));
      setPhaseLater(docType);
    } catch (err) {
      setError(err.message || "Upload failed");
      setDocs((current) => {
        const next = { ...current };
        delete next[docType];
        return next;
      });
    }
  };

  const ready = DOC_TYPES.every((type) => docs[type.key]?.phase === "stored");

  const handleSubmit = async () => {
    if (!org) return;
    setError("");
    if (!ready) {
      setError("Upload all three documents to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await submitVerificationCase(org.id);
      navigate("/onboarding/pending", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to submit documents");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingShell step="documents">
      <div className="font-mono-tech text-muted-foreground">STEP 02 / VERIFICATION DOCUMENTS</div>
      <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-foreground">
        Upload verification documents
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Files are encrypted and pinned by the backend. Submitting moves your organization to review.
      </p>

      {error && (
        <div className="mt-6 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-px">
        {DOC_TYPES.map((type) => {
          const state = docs[type.key];
          return (
            <div key={type.key} className="border border-foreground/15">
              <DocUploader label={type.label} docKey={type.key} state={state} onFile={handleFile} />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-foreground/15 pt-6">
        <span className="font-mono-tech text-muted-foreground">
          {ready ? "ALL DOCUMENTS STORED" : "AWAITING UPLOADS"}
        </span>
        <Button
          onClick={handleSubmit}
          className="h-12 rounded-none bg-primary px-7 font-medium hover:bg-primary/90"
          disabled={!ready || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit for review
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </OnboardingShell>
  );
}

function DocUploader({ label, docKey, state, onFile }) {
  const inputId = `doc-${docKey}`;
  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {state?.file && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">{state.file.name}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {state && (
          <div className="flex items-center gap-2 font-mono-tech text-muted-foreground">
            {state.phase === "stored" ? (
              <span className="flex items-center text-[hsl(170,60%,30%)]">
                <Check className="mr-1 h-3.5 w-3.5" /> STORED
              </span>
            ) : (
              <span className="flex items-center">
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                {PHASE_LABEL[state.phase] || "Processing"}
              </span>
            )}
          </div>
        )}
        <label
          htmlFor={inputId}
          className="inline-flex min-h-[40px] cursor-pointer items-center border border-foreground/25 bg-transparent px-4 text-sm text-foreground transition-colors hover:bg-foreground/5"
        >
          {state?.file ? (
            <>
              <Lock className="mr-2 h-4 w-4" /> Re-upload
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" /> Upload
            </>
          )}
          <input
            id={inputId}
            type="file"
            className="hidden"
            onChange={(e) => onFile(docKey, e.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
