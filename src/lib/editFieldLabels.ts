/**
 * Human-readable labels for profile_edit_requests.field_name values.
 * Mirrors the CHECK constraint list in migration 00081.
 */
export const EDIT_FIELD_LABELS: Record<string, string> = {
  bio: "Bio",
  tagline: "Tagline",
  skills: "Skills",
  tools: "Tools",
  role_category: "Role",
  country: "Country",
  hourly_rate: "Hourly Rate",
  years_experience: "Years of Experience",
  us_client_experience: "US Client Experience",
  profile_photo_url: "Profile Photo",
  voice_recording_1_url: "Voice Recording (Oral Reading)",
  voice_recording_2_url: "Voice Recording (Open-Ended)",
  work_experience: "Work Experience",
  video_intro_url: "Video Introduction",
};

export function labelFor(fieldName: string): string {
  return EDIT_FIELD_LABELS[fieldName] ?? fieldName;
}

/** Media fields store a staged storage path in new_value, not an inline JSON value. */
export const MEDIA_FIELDS = new Set([
  "profile_photo_url",
  "voice_recording_1_url",
  "voice_recording_2_url",
  "video_intro_url",
]);

/** Maps a media field to its storage bucket. */
export const MEDIA_FIELD_BUCKET: Record<string, string> = {
  profile_photo_url: "profile-photos",
  voice_recording_1_url: "voice-recordings",
  voice_recording_2_url: "voice-recordings",
  video_intro_url: "video-intros",
};

export function isMediaField(fieldName: string): boolean {
  return MEDIA_FIELDS.has(fieldName);
}
