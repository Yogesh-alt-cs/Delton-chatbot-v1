import { Moon, Sun, Monitor, LogOut, User, Bell, Download, FileText, FileJson, FileType, Volume2, Trash2, Sparkles, Globe, Shield, Type, Info, Star, MessageSquare, Sliders } from 'lucide-react';
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

const responseLengthOptions = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
] as const;

const fontSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;

function SettingsCard({ icon: Icon, iconColor, title, description, children, borderColor }: {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  borderColor?: string;
}) {
  return (
    <section className={cn(
      "settings-card",
      borderColor
    )}>
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
          <Icon className={cn("h-4.5 w-4.5", iconColor || "text-foreground")} />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingsRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  const currentTheme = settings?.theme || 'system';
  const notificationsEnabled = settings?.notifications_enabled ?? true;
  const currentVoice = settings?.tts_voice_name || 'default';
  const currentStyle = settings?.personalization_style || 'balanced';
  const currentLanguage = settings?.voice_language || 'en-US';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => updateSettings({ theme });

  const handleNotificationsChange = async (enabled: boolean) => {
    if (enabled && notificationsSupported) {
      const granted = await toggleNotifications();
      if (granted) updateSettings({ notifications_enabled: true });
    } else {
      updateSettings({ notifications_enabled: enabled });
    }
  };

  const handleVoiceChange = (voiceName: string) => updateSettings({ tts_voice_name: voiceName });
  const handleStyleChange = (style: string) => updateSettings({ personalization_style: style });

  const handleLanguageChange = (language: string) => {
    updateSettings({ voice_language: language });
    toast({ title: 'Language Updated', description: 'Voice recognition language has been changed.' });
  };

  const handleNameSave = () => {
    updateSettings({ personalization_name: personalizationName || null });
    toast({ title: 'Saved', description: 'Your name preference has been updated.' });
  };

  const handleClearHistory = async () => {
    setIsClearing(true);
    const success = await clearAllHistory();
    setIsClearing(false);
    toast(success
      ? { title: 'History Cleared', description: 'All your conversations have been deleted.' }
      : { title: 'Error', description: 'Failed to clear history. Please try again.', variant: 'destructive' }
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-y-auto">
        <header className="border-b border-border px-4 py-3 sm:p-4 safe-top">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Settings</h1>
        </header>

        <div className="flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-7 space-y-3 sm:space-y-4 max-w-[720px] mx-auto w-full">
          {/* Profile */}
          <section
            className="settings-card cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => navigate('/profile')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{profile?.display_name || user?.email}</p>
                <p className="text-sm text-muted-foreground">View profile</p>
              </div>
            </div>
          </section>

          {/* Personalization */}
          <SettingsCard icon={Sparkles} iconColor="text-primary" title="Personalization" description="Customize how Delton interacts with you">
            <div className="space-y-1">
              <SettingsRow label="Your Name" description="Delton will use this name when talking to you">
                <div className="flex gap-2">
                  <Input
                    placeholder="Your name"
                    value={personalizationName}
                    onChange={(e) => setPersonalizationName(e.target.value)}
                    className="w-36 h-8 text-sm bg-accent border-border/50"
                  />
                  <Button size="sm" variant="outline" onClick={handleNameSave} className="h-8">Save</Button>
                </div>
              </SettingsRow>
              <SettingsRow label="Conversation Style">
                <Select value={currentStyle} onValueChange={handleStyleChange}>
                  <SelectTrigger className="w-40 h-8 text-sm bg-accent border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {styleOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* AI Behavior */}
          <SettingsCard icon={Sliders} iconColor="text-primary" title="AI Behavior" description="Control how Delton responds">
            <div className="space-y-1">
              <SettingsRow label="Response Length" description="How detailed AI responses should be">
                <div className="flex gap-1 bg-accent rounded-lg p-0.5">
                  {responseLengthOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStyleChange(opt.value === 'concise' ? 'concise' : opt.value === 'detailed' ? 'detailed' : 'balanced')}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        currentStyle === opt.value || (opt.value === 'balanced' && !['concise', 'detailed'].includes(currentStyle))
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </SettingsRow>
              <SettingsRow label="Auto-suggest Prompts" description="Show suggested follow-up prompts">
                <Switch checked={autoSuggest} onCheckedChange={setAutoSuggest} />
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* Voice & Language */}
          <SettingsCard icon={Globe} title="Voice & Language" description="Configure voice recognition and TTS">
            <div className="space-y-1">
              <SettingsRow label="Voice Language">
                <Select value={currentLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-44 h-8 text-sm bg-accent border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span><span>{lang.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow label="TTS Voice">
                <Select value={currentVoice} onValueChange={handleVoiceChange}>
                  <SelectTrigger className="w-44 h-8 text-sm bg-accent border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    <SelectItem value="default">System Default</SelectItem>
                    {voices.map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* Appearance */}
          <SettingsCard icon={Sun} title="Appearance" description="Theme and display preferences">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                    currentTheme === value
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-accent hover:bg-accent/80"
                  )}
                >
                  <Icon className={cn("h-5 w-5", currentTheme === value ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium", currentTheme === value ? "text-primary" : "text-muted-foreground")}>{label}</span>
                </button>
              ))}
            </div>
          </SettingsCard>

          {/* Notifications */}
          <SettingsCard icon={Bell} title="Notifications">
            <SettingsRow
              label="Push Notifications"
              description={notificationsSupported ? (pushEnabled ? 'Enabled' : 'Get updates and alerts') : 'Not supported in this browser'}
            >
              <Switch
                checked={notificationsEnabled && pushEnabled}
                onCheckedChange={handleNotificationsChange}
                disabled={!notificationsSupported}
              />
            </SettingsRow>
          </SettingsCard>

          {/* Accessibility */}
          <SettingsCard icon={Type} title="Accessibility" description="Display and readability options">
            <div className="space-y-1">
              <SettingsRow label="Font Size">
                <div className="flex gap-1 bg-accent rounded-lg p-0.5">
                  {fontSizeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFontSize(opt.value)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        fontSize === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </SettingsRow>
              <SettingsRow label="High Contrast Mode" description="Increase contrast for better readability">
                <Switch checked={highContrast} onCheckedChange={setHighContrast} />
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* Privacy & Security */}
          <SettingsCard icon={Shield} iconColor="text-destructive" title="Privacy & Security" borderColor="settings-card-danger">
            <div className="space-y-1">
              <SettingsRow label="Export Data" description="Download your conversations">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8"><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem onClick={() => exportConversations('txt')}><FileText className="mr-2 h-4 w-4" />TXT</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportConversations('json')}><FileJson className="mr-2 h-4 w-4" />JSON</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportConversations('pdf')}><FileType className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SettingsRow>
              <SettingsRow label="Clear All History" description="Delete all conversations permanently">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8" disabled={isClearing}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />{isClearing ? 'Clearing...' : 'Clear'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-popover border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all your conversations. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SettingsRow>
              <SettingsRow label="Delete Account" description="Permanently delete your account and data">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-popover border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete your account, all conversations, and data. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toast({ title: 'Contact Support', description: 'Please contact support to delete your account.' })}>
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* About */}
          <SettingsCard icon={Info} title="About Delton" description="App information">
            <div className="space-y-1">
              <SettingsRow label="Version">
                <span className="text-sm text-muted-foreground">2.0.0</span>
              </SettingsRow>
              <SettingsRow label="Rate the App">
                <Button variant="outline" size="sm" className="h-8"><Star className="mr-1.5 h-3.5 w-3.5" />Rate</Button>
              </SettingsRow>
              <SettingsRow label="Send Feedback">
                <Button variant="outline" size="sm" className="h-8"><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Feedback</Button>
              </SettingsRow>
            </div>
          </SettingsCard>

          {/* Sign Out */}
          <Button variant="destructive" className="w-full h-11" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />Sign Out
          </Button>

          <div className="pt-2 pb-6 text-center">
            <p className="text-xs text-muted-foreground">Created by Yogesh GR</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
