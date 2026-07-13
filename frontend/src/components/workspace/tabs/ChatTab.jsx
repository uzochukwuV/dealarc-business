import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Loader2, Send, FileText, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { monogram, fmtDateTime } from "@/lib/workspace-utils";
import { convertMessage, listMessages, sendMessage } from "@/backend/workspaces";

export default function ChatTab() {
  const { workspace, user, org } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [convert, setConvert] = useState(null);
  const [convertForm, setConvertForm] = useState({});
  const [convertLoading, setConvertLoading] = useState(false);
  const scrollRef = useRef(null);

  const loadMessages = async () => setMessages(await listMessages(workspace.id));

  useEffect(() => {
    (async () => { try { await loadMessages(); } catch {} finally { setLoading(false); } })();
  }, [workspace.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0, behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage(workspace.id, { body: text.trim(), senderOrgId: org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "" });
      setText("");
      await loadMessages();
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openConvert = (mode, message) => {
    setConvert({ mode, message });
    setConvertForm(mode === "requirement"
      ? { item: "", quantity: "", specs: message.text, delivery: "", deadline: "", budget_range: "", certifications: "" }
      : { price: "", quantity: "", deliveryTerms: "", paymentStructure: "", warranty: "", validity: "", changeSummary: `Converted from chat - ${message.text.slice(0, 100)}` }
    );
  };

  const submitConvert = async (e) => {
    e.preventDefault();
    setConvertLoading(true);
    try {
      // The backend conversion endpoint creates the target object and links the message.
      await convertMessage(workspace.id, convert.message.id, { targetType: convert.mode.toUpperCase(), senderOrgId: org?.id || org?.legal_name || workspace.participantOrgIds?.[0] || "", fields: convertForm });
      toast({ title: `Converted to ${convert.mode}` });
      setConvert(null);
      await loadMessages();
    } catch (err) {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
    } finally {
      setConvertLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="font-mono-tech text-muted-foreground">CHAT / NEGOTIATION THREAD</div>
      <p className="mt-1 text-sm text-muted-foreground">Messages are backed by the backend now.</p>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div ref={scrollRef} className="mt-6 max-h-[480px] space-y-4 overflow-y-auto border border-foreground/15 bg-card p-6">
          {messages.length === 0 ? <p className="py-12 text-center font-mono-tech text-muted-foreground">NO MESSAGES YET</p> : messages.map((msg) => <MessageBubble key={msg.id} msg={msg} onConvert={openConvert} />)}
        </div>
      )}

      <form onSubmit={send} className="mt-px flex gap-3 border border-foreground/15 bg-card p-4">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="h-12 flex-1 rounded-none border-foreground/20" />
        <Button type="submit" disabled={sending || !text.trim()} className="h-12 rounded-none bg-primary px-6 hover:bg-primary/90">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Send</Button>
      </form>

      <Dialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)}>
        <DialogContent className="max-w-lg rounded-sm border-foreground/15 bg-background p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle className="font-heading text-xl font-medium">Convert to {convert?.mode}</DialogTitle></DialogHeader>
          <form onSubmit={submitConvert} className="space-y-4 px-6 pb-6">
            {convert?.mode === "requirement" ? (
              <>
                {[["Item", "item"], ["Quantity", "quantity"], ["Delivery", "delivery"], ["Budget range", "budget_range"], ["Certifications", "certifications"]].map(([label, key]) => <Field key={key} label={label} value={convertForm[key]} onChange={(v) => setConvertForm((f) => ({ ...f, [key]: v }))} />)}
                <div className="space-y-2"><Label className="font-mono-tech text-foreground">SPECIFICATIONS</Label><Textarea value={convertForm.specs} onChange={(e) => setConvertForm((f) => ({ ...f, specs: e.target.value }))} className="min-h-[80px] rounded-none border-foreground/20" /></div>
              </>
            ) : (
              <>
                {[["Price", "price"], ["Quantity", "quantity"], ["Delivery terms", "deliveryTerms"], ["Payment structure", "paymentStructure"], ["Warranty", "warranty"], ["Validity", "validity"]].map(([label, key]) => <Field key={key} label={label} value={convertForm[key]} onChange={(v) => setConvertForm((f) => ({ ...f, [key]: v }))} />)}
                <div className="space-y-2"><Label className="font-mono-tech text-foreground">WHAT CHANGED</Label><Textarea value={convertForm.changeSummary} onChange={(e) => setConvertForm((f) => ({ ...f, changeSummary: e.target.value }))} className="min-h-[60px] rounded-none border-foreground/20" /></div>
              </>
            )}
            <div className="flex justify-end border-t border-foreground/15 pt-4"><Button type="submit" disabled={convertLoading} className="h-11 rounded-none bg-primary px-6 hover:bg-primary/90">{convertLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ msg, onConvert }) {
  const isConverted = msg.converted_to && msg.converted_to !== "none";
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-foreground text-[11px] font-medium text-background">{monogram(msg.sender_name)}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">{msg.sender_name}</span><span className="font-mono text-[10px] text-muted-foreground">{msg.sender_org} ? {msg.sender_role}</span></div>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{msg.text}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">{fmtDateTime(msg.created_date)}</span>
          {isConverted ? <span className="font-mono text-[10px] text-[hsl(170,60%,30%)]">? CONVERTED TO {String(msg.converted_to).toUpperCase()}</span> : <div className="flex gap-2"><button onClick={() => onConvert("requirement", msg)} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"><FileText className="h-3 w-3" /> REQUIREMENT</button><button onClick={() => onConvert("proposal", msg)} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"><FileCheck className="h-3 w-3" /> PROPOSAL</button></div>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return <div className="space-y-2"><Label className="font-mono-tech text-foreground">{label.toUpperCase()}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-none border-foreground/20" /></div>;
}
