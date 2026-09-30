"use client";

import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Input, Select, Submit } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addCalendarEventAction } from "@/server/actions/projects";

export function AddMeetingDialog({ projects }: { projects: { id: string; name: string }[] }) {
  return (
    <Dialog title="New meeting" trigger={(open) => <Button variant="primary" onClick={open}><Plus className="size-4" />Meeting</Button>}>
      {(close) => (
        <Form action={addCalendarEventAction} onSuccess={close} className="space-y-4">
          <Field label="Title" name="title"><Input name="title" required placeholder="Design review" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" name="startsAt"><Input name="startsAt" type="datetime-local" required /></Field>
            <Field label="Ends" name="endsAt" optional><Input name="endsAt" type="datetime-local" /></Field>
            <Field label="Location" name="location" optional><Input name="location" placeholder="Google Meet, office…" /></Field>
            <Field label="Project" name="projectId" optional><Select name="projectId" defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <div className="flex justify-end gap-2"><Button onClick={close}>Cancel</Button><Submit>Add meeting</Submit></div>
        </Form>
      )}
    </Dialog>
  );
}
