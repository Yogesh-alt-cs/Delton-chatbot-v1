import { Moon, Sun, Monitor, LogOut, User, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{user?.email}</p>
                <p className="text-sm text-muted-foreground">Manage your account</p>
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
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                    theme === value
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted hover:bg-muted/80"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    theme === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    theme === value ? "text-primary" : "text-muted-foreground"
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
              <Switch />
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
