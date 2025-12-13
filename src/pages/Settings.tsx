import { Moon, Sun, Monitor, LogOut, User, Bell, Download, FileText, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useProfile } from '@/hooks/useProfile';
import { useExportData } from '@/hooks/useExportData';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export default function Settings() {
  const { user, signOut } = useAuth();
  const { settings, updateSettings } = useUserSettings();
  const { profile } = useProfile();
  const { exportConversations } = useExportData();
  const navigate = useNavigate();

  const currentTheme = settings?.theme || 'system';
  const notificationsEnabled = settings?.notifications_enabled ?? true;

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
  };

  const handleNotificationsChange = (enabled: boolean) => {
    updateSettings({ notifications_enabled: enabled });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
        {/* Header */}
        <header className="border-b border-border p-4 safe-top">
          <h1 className="text-xl font-bold">Settings</h1>
        </header>

        <div className="flex-1 p-4 space-y-6">
          {/* Profile Section */}
          <section 
            className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/profile')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Avatar" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {profile?.display_name || user?.email}
                </p>
                <p className="text-sm text-muted-foreground">View profile</p>
              </div>
            </div>
          </section>

          {/* Theme Section */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Appearance</h2>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                    currentTheme === value
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted hover:bg-muted/80"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    currentTheme === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    currentTheme === value ? "text-primary" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Notifications Section */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications
                  </p>
                </div>
              </div>
              <Switch 
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationsChange}
              />
            </div>
          </section>

          {/* Export Data Section */}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-muted-foreground">
                    Download your conversations
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportConversations('txt')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportConversations('json')}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          {/* Sign Out */}
          <Button
            variant="destructive"
            className="w-full h-11"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>

          {/* App Info */}
          <div className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Delton Chatbot v1.0.0
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by Lovable AI
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
