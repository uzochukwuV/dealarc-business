import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Upload, PenLine, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { getAgreement, uploadAgreement, signAgreement } from "@/backend/agreements";
import { apiRequest } from "@/lib/backend-request.js";

export default function ContractTab() {
  const { workspace } = useOutletContext();
  const [agreement, setAgreement] = useState(null);
  const [termSheet, setTermSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [file, setFile] = useState(null);

  const load = async () => {
    try { setAgreement(await getAgreement(workspace.id)); } catch { setAgreement(null); }
    try { setTermSheet(await apiRequest(`/workspaces/${workspace.id}/term-sheet`)); } catch { setTermSheet(null); }
  };

  useEffect(() => {
    (async () => { try { await load(); } finally { setLoading(false); } })();
  }, [workspace.id]);

  const submitUpload = async () => {
    if (!file || !termSheet?.id) return;
    setUploading(true);
    try {
      const next = await uploadAgreement(workspace.id, file, termSheet.id);
      setAgreement(next);
      toast({ title: "Agreement uploaded" });
      await load();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const sign = async () => {
    setSigning(true);
    try {
      const next = await signAgreement(workspace.id);
      setAgreement(next);
      toast({ title: "Agreement signed" });
      await load();
    } catch (err) {
      toast({ title: "Signing failed", description: err.message, variant: "destructive" });
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8 space-y-6">
      <div>
        <div className="font-mono-tech text-muted-foreground">CONTRACT</div>
        <p className="mt-1 text-sm text-muted-foreground">Upload the agreement after terms are locked, then collect signatures.</p>
      </div>

      <div className="border border-foreground/15 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-foreground">Agreement status</div>
            <div className="text-sm text-muted-foreground">{agreement?.status || "NOT_CREATED"}</div>
          </div>
          <div className="text-xs uppercase text-muted-foreground">{workspace.status}</div>
        </div>

        {agreement ? (
          <div className="space-y-3 border-t border-foreground/10 pt-4 text-sm">
            <div>Agreement hash: <span className="font-mono text-xs text-muted-foreground">{agreement.agreementHash}</span></div>
            <div>Signatures: {agreement.signatures?.length || 0}</div>
            <div className="space-y-2">
              {agreement.signatures?.map((sig, i) => <div key={i} className="rounded border border-foreground/10 px-3 py-2 text-xs text-muted-foreground">{sig.userId || sig.name} · {sig.signedAt || sig.signed_at}</div>)}
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t border-foreground/10 pt-4">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="h-11 rounded-none border-foreground/20" />
            <div className="flex justify-end">
              <Button disabled={!file || !termSheet?.id || uploading} onClick={submitUpload} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload agreement
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-foreground/10 pt-4">
          <Button disabled={!agreement || signing} onClick={sign} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">
            {signing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />} Sign agreement
          </Button>
        </div>
      </div>
    </div>
  );
}
