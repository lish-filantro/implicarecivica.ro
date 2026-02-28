export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  notification_email: boolean;
  notification_deadline_days: number;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  display_name?: string | null;
  avatar_url?: string | null;
  notification_email?: boolean;
  notification_deadline_days?: number;
  theme?: 'light' | 'dark' | 'system';
}
