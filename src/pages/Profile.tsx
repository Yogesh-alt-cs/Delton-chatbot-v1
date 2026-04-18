import { useRef } from 'react';
import { Camera, User, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, uploadAvatar } = useProfile();
  const { conversations } = useConversations();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAvatar(file);
  };

  const memberSince = user?.created_at
    ? format(new Date(user.created_at), 'MMM yyyy').toUpperCase()
    : 'UNKNOWN';

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase animate-pulse">
            &gt; LOADING_PROFILE...
          </span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
        {/* Header */}
        <header className="brutal-border-b p-4 safe-top flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              &gt; USER_PROFILE
            </span>
            <h1 className="font-display text-2xl mt-1">PROFILE</h1>
          </div>
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            ACCESS:LEVEL_PRO
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          {/* Avatar block */}
          <section className="brutal-border p-6 flex flex-col items-center gap-4">
            <div className="relative">
              <div
                onClick={handleAvatarClick}
                className="flex h-28 w-28 cursor-pointer items-center justify-center brutal-border bg-background overflow-hidden"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-14 w-14 text-foreground" />
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center bg-foreground text-background brutal-border"
                aria-label="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="text-center brutal-border-t w-full pt-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                &gt; IDENTITY
              </span>
              <h2 className="font-display text-2xl mt-1 uppercase">
                {profile?.display_name || 'UNNAMED_USER'}
              </h2>
              <p className="font-mono text-xs tracking-wider text-muted-foreground mt-1 break-all">
                {user?.email}
              </p>
            </div>

            <Button
              onClick={() => navigate('/profile/edit')}
              className="btn-brutal w-full tracking-widest text-xs"
            >
              [ EDIT_PROFILE ]
            </Button>
          </section>

          {/* Bio block */}
          {profile?.bio && (
            <section className="brutal-border p-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                &gt; BIO
              </span>
              <p className="font-sans text-sm mt-2 leading-relaxed">{profile.bio}</p>
            </section>
          )}

          {/* Stats */}
          <section className="brutal-border">
            <div className="brutal-border-b p-3 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                &gt; STATISTICS
              </span>
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-foreground">
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    Conversations
                  </span>
                </div>
                <p className="font-display text-4xl">{conversations.length}</p>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    Member Since
                  </span>
                </div>
                <p className="font-display text-2xl">{memberSince}</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase text-center pt-4">
            VER:2.0.0_STABLE // SYSTEM_DELTON
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
