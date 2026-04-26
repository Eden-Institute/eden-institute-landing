import { useState, useEffect, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useActiveProfile,
  type PersonProfile,
} from "@/contexts/ActiveProfileContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  profile?: PersonProfile;
}

/**
 * Profile create/edit Dialog.
 *
 * Form fields cover the non-diagnostic columns of person_profiles. The
 * diagnostic-stack columns (eden_constitution, galenic_temperament,
 * vital_force_reading, diagnostic_completed_at) are NOT in this form — they
 * are populated by triggers:
 *   - eden_constitution: tg_quiz_completion_sync_constitution (marketing quiz)
 *   - galenic_temperament + vital_force_reading + diagnostic_completed_at:
 *       tg_diagnostic_completion_sync_profile (deep diagnostic, per Lock #37)
 *
 * Validation rules:
 *   - name required (1-120 chars)
 *   - date_of_birth between 1900-01-01 and today
 *   - biological_sex / profile_kind enum values enforced by Postgres enums
 *   - is_self: only one profile per user can be self (uniq_person_profiles_self_per_user
 *     partial unique index). Checkbox is disabled when another profile already
 *     holds is_self = true.
 *   - cap enforced by tg_person_profiles_enforce_cap BEFORE INSERT trigger;
 *     friendly error surfaced when the trigger raises 'profile_cap_exceeded'.
 */
export function ProfileFormDialog({
  open,
  onClose,
  mode,
  profile,
}: ProfileFormDialogProps) {
  const { user } = useAuth();
  const { profiles, refetchProfiles, setActiveProfileId } = useActiveProfile();
  const hasExistingSelf = profiles.some(
    (p) => p.is_self && p.id !== profile?.id,
  );

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [biologicalSex, setBiologicalSex] = useState<"male" | "female">(
    "female",
  );
  const [profileKind, setProfileKind] = useState<"adult" | "child">("adult");
  const [isSelf, setIsSelf] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && profile) {
      setName(profile.name);
      setDob(profile.date_of_birth);
      setBiologicalSex(profile.biological_sex);
      setProfileKind(profile.profile_kind);
      setIsSelf(profile.is_self);
      setAllergies(profile.allergies ?? "");
      setMedications(profile.medications ?? "");
      setConditions(profile.conditions ?? "");
      setNotes(profile.notes ?? "");
    } else {
      setName("");
      setDob("");
      setBiologicalSex("female");
      setProfileKind("adult");
      setIsSelf(!hasExistingSelf);
      setAllergies("");
      setMedications("");
      setConditions("");
      setNotes("");
    }
    setError(null);
  }, [mode, profile, open, hasExistingSelf]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!name.trim()) throw new Error("Name required");
      if (!dob) throw new Error("Date of birth required");

      const payload = {
        user_id: user.id,
        name: name.trim(),
        date_of_birth: dob,
        biological_sex: biologicalSex,
        profile_kind: profileKind,
        is_self: isSelf,
        allergies: allergies.trim() || null,
        medications: medications.trim() || null,
        conditions: conditions.trim() || null,
        notes: notes.trim() || null,
      };

      if (mode === "create") {
        const { data, error } = await supabase
          .from("person_profiles")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as PersonProfile;
      }
      if (!profile) throw new Error("Edit mode requires existing profile");
      const { data, error } = await supabase
        .from("person_profiles")
        .update(payload)
        .eq("id", profile.id)
        .select()
        .single();
      if (error) throw error;
      return data as PersonProfile;
    },
    onSuccess: async (saved) => {
      await refetchProfiles();
      if (mode === "create") {
        setActiveProfileId(saved.id);
      }
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      if (message.includes("profile_cap_exceeded")) {
        setError(
          "Profile cap reached for your tier. Upgrade to add more profiles.",
        );
      } else if (message.includes("uniq_person_profiles_self_per_user")) {
        setError(
          "You already have a self profile. Only one profile per account can be marked as self.",
        );
      } else {
        setError(message);
      }
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {mode === "create" ? "Add a person profile" : "Edit profile"}
          </DialogTitle>
          <DialogDescription className="font-body">
            Person cards are how the directory tailors recommendations to a
            specific terrain. Constitutional-quiz results land on the profile
            automatically once the quiz is completed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-dob">Date of birth</Label>
            <Input
              id="profile-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              min="1900-01-01"
              max={today}
              required
              className="min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profile-sex">Biological sex</Label>
              <Select
                value={biologicalSex}
                onValueChange={(v) => setBiologicalSex(v as "male" | "female")}
              >
                <SelectTrigger id="profile-sex" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-kind">Adult or child</Label>
              <Select
                value={profileKind}
                onValueChange={(v) => setProfileKind(v as "adult" | "child")}
              >
                <SelectTrigger id="profile-kind" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-start gap-2 py-1">
            <input
              id="profile-is-self"
              type="checkbox"
              checked={isSelf}
              onChange={(e) => setIsSelf(e.target.checked)}
              disabled={hasExistingSelf && !profile?.is_self}
              className="w-5 h-5 cursor-pointer mt-0.5"
            />
            <Label
              htmlFor="profile-is-self"
              className="font-body cursor-pointer leading-tight"
            >
              This profile is me
              {hasExistingSelf && !profile?.is_self && (
                <span className="text-xs text-muted-foreground ml-2 block">
                  (you already have a self profile)
                </span>
              )}
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-allergies">Allergies (optional)</Label>
            <Textarea
              id="profile-allergies"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              rows={2}
              placeholder="e.g., ragweed, penicillin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-meds">Medications (optional)</Label>
            <Textarea
              id="profile-meds"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              rows={2}
              placeholder="e.g., lisinopril 10mg daily"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-conditions">Conditions (optional)</Label>
            <Textarea
              id="profile-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-notes">Notes (optional)</Label>
            <Textarea
              id="profile-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <div className="text-sm text-destructive font-body">{error}</div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="eden"
              disabled={mutation.isPending}
              className="min-h-[44px]"
            >
              {mutation.isPending
                ? "Saving…"
                : mode === "create"
                  ? "Add profile"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
