export interface AuthStatus {
  logged_in: boolean;
  username?: string;
  role?: string;
  user_id?: string | null;
  yjb_bound?: boolean;
  yjb_nickname?: string;
  yjb_avatar?: string;
  yjb_login_time?: string;
}

export interface AdminUserItem {
  user_id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  yjb_bound: boolean;
  yjb_nickname: string;
  yjb_login_time: string;
}

export interface YjbQrStatusResponse {
  state: string;
  nickname?: string;
  avatar?: string;
  yjb_nickname?: string;
  yjb_bound?: boolean;
}
