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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
  };

  const totalMessages = conversations.reduce((acc) => acc + 1, 0);
  const memberSince = user?.created_at 
    ? format(new Date(user.created_at), 'MMMM yyyy')
    : 'Unknown';

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
        <header className="border-b border-border p-4 safe-top">
          <h1 className="text-xl font-bold">Profile</h1>
        </header>

        <div className="flex-1 p-4 space-y-6">
          {/* Avatar Section */}
          <section className="flex flex-col items-center gap-4">
            <div className="relative">
              <div 
                onClick={handleAvatarClick}
                className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-full bg-primary/10 overflow-hidden ring-4 ring-primary/20 transition-all hover:ring-primary/40"
              >
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-primary" />
                )}
              </div>
              <button 
                onClick={handleAvatarClick}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
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

            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {profile?.display_name || 'Set your name'}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>

            <Button 
              variant="outline" 
              onClick={() => navigate('/profile/edit')}
            >
              Edit Profile
            </Button>
          </section>

          {/* Bio Section */}
          {profile?.bio && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            </section>
          )}

          {/* Stats Section */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-4 font-semibold">Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-semibold">{conversations.length}</p>
                  <p className="text-xs text-muted-foreground">Conversations</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{memberSince}</p>
                  <p className="text-xs text-muted-foreground">Member since</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
