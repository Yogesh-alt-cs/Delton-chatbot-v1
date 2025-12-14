import { Moon, Sun, Monitor, LogOut, User, Bell, Download, FileText, FileJson, Volume2, Trash2, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useProfile } from '@/hooks/useProfile';
import { useExportData } from '@/hooks/useExportData';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const styleOptions = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'friendly', label: 'Friendly & Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'concise', label: 'Brief & Concise' },
  { value: 'detailed', label: 'Detailed & Thorough' },
] as const;

const languageOptions = [
  { value: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { value: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { value: 'es-ES', label: 'Spanish (Spain)', flag: '🇪🇸' },
  { value: 'es-MX', label: 'Spanish (Mexico)', flag: '🇲🇽' },
  { value: 'fr-FR', label: 'French', flag: '🇫🇷' },
  { value: 'de-DE', label: 'German', flag: '🇩🇪' },
  { value: 'it-IT', label: 'Italian', flag: '🇮🇹' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { value: 'hi-IN', label: 'Hindi', flag: '🇮🇳' },
  { value: 'zh-CN', label: 'Chinese (Simplified)', flag: '🇨🇳' },
  { value: 'ja-JP', label: 'Japanese', flag: '🇯🇵' },
  { value: 'ko-KR', label: 'Korean', flag: '🇰🇷' },
  { value: 'ar-SA', label: 'Arabic', flag: '🇸🇦' },
  { value: 'ru-RU', label: 'Russian', flag: '🇷🇺' },
] as const;

export default function Settings() {
  const { user, signOut } = useAuth();
  const { settings, updateSettings, clearAllHistory } = useUserSettings();
  const { profile } = useProfile();
  const { exportConversations } = useExportData();
  const { isSupported: notificationsSupported, isEnabled: pushEnabled, toggleNotifications } = usePushNotifications();
  const { voices } = useTextToSpeech();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [personalizationName, setPersonalizationName] = useState(settings?.personalization_name || '');
  const [isClearing, setIsClearing] = useState(false);

  const currentTheme = settings?.theme || 'system';
  const notificationsEnabled = settings?.notifications_enabled ?? true;
  const currentVoice = settings?.tts_voice_name || 'default';
  const currentStyle = settings?.personalization_style || 'balanced';
  const currentLanguage = settings?.voice_language || 'en-US';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    if (enabled && notificationsSupported) {
      const granted = await toggleNotifications();
      if (granted) {
        updateSettings({ notifications_enabled: true });
      }
    } else {
      updateSettings({ notifications_enabled: enabled });
    }
  };

  const handleVoiceChange = (voiceName: string) => {
    updateSettings({ tts_voice_name: voiceName });
  };

  const handleStyleChange = (style: string) => {
    updateSettings({ personalization_style: style });
  };

  const handleLanguageChange = (language: string) => {
    updateSettings({ voice_language: language });
    toast({
      title: 'Language Updated',
      description: 'Voice recognition language has been changed.',
    });
  };

  const handleNameSave = () => {
    updateSettings({ personalization_name: personalizationName || null });
    toast({
      title: 'Saved',
      description: 'Your name preference has been updated.',
    });
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    const success = await clearAllHistory();
    setIsClearing(false);
    
    if (success) {
      toast({
        title: 'History Cleared',
        description: 'All your conversations have been deleted.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to clear history. Please try again.',
        variant: 'destructive',
      });
    }
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

          {/* Personalization Section */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Personalization</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Your Name</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="How should Delton call you?"
                    value={personalizationName}
                    onChange={(e) => setPersonalizationName(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleNameSave}>Save</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Delton will use this name when talking to you
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Conversation Style</label>
                <Select value={currentStyle} onValueChange={handleStyleChange}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {styleOptions.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Voice Language Section */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Voice Recognition Language</h2>
            </div>
            
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50 max-h-60">
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the language for voice input recognition
            </p>
          </section>

          {/* Voice Settings Section */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Text-to-Speech Voice</h2>
            </div>
            
            <Select value={currentVoice} onValueChange={handleVoiceChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50 max-h-60">
                <SelectItem value="default">System Default</SelectItem>
                {voices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose a voice for reading AI responses aloud
            </p>
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
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {notificationsSupported 
                      ? (pushEnabled ? 'Enabled' : 'Get updates and alerts')
                      : 'Not supported in this browser'}
                  </p>
                </div>
              </div>
              <Switch 
                checked={notificationsEnabled && pushEnabled}
                onCheckedChange={handleNotificationsChange}
                disabled={!notificationsSupported}
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
                <DropdownMenuContent align="end" className="bg-background border border-border z-50">
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

          {/* Clear History Section */}
          <section className="rounded-xl border border-destructive/30 bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium">Clear All History</p>
                  <p className="text-sm text-muted-foreground">
                    Delete all conversations permanently
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isClearing}>
                    {isClearing ? 'Clearing...' : 'Clear'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-background border border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your conversations. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
