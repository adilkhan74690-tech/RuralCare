import React, { useState } from 'react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalSelect } from '../components/ui/BrutalSelect';
import { 
  User, 
  Globe, 
  RefreshCw, 
  Trash2, 
  Check,
  ShieldCheck,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsProps {
  onClearAll: () => Promise<void> | void;
  patientCount: number;
  followUpCount: number;
  taskCount: number;
  queueCount: number;
}

export const Settings: React.FC<SettingsProps> = ({
  onClearAll,
  patientCount,
  followUpCount,
  taskCount,
  queueCount,
}) => {
  const { user } = useAuth();

  // Language Preference
  const [language, setLanguage] = useState('en');

  // Sync Preferences
  const [autoSyncOnline, setAutoSyncOnline] = useState(true);

  const [isClearing, setIsClearing] = useState(false);
  const [saveBanner, setSaveBanner] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 3000);
  };

  const handleClearLocalData = async () => {
    setClearError(null);

    // Block clearing if unsynced changes exist
    if (queueCount > 0) {
      setClearError(
        `Action Blocked: You have ${queueCount} unsynchronized field record(s) on this device that have not uploaded to the central database. Please synchronize your changes first to avoid data loss.`
      );
      return;
    }

    if (
      window.confirm(
        'Are you sure you want to clear local cache data on this device? All records that have been synchronized remain safely in the central PostgreSQL database.'
      )
    ) {
      setIsClearing(true);
      try {
        await onClearAll();
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="pb-4 border-b-2 border-black">
        <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
          Worker account profile, language preferences, and device storage management
        </p>
      </div>

      {saveBanner && (
        <div className="p-3.5 bg-forest border-2 border-black rounded-xl text-white text-xs font-black flex items-center gap-2 shadow-brutal-xs">
          <Check className="w-4 h-4 text-white stroke-[3]" />
          <span>Preferences updated successfully.</span>
        </div>
      )}

      {/* 2. Authenticated Worker Profile */}
      <section className="bg-white p-6 sm:p-7 border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b-2 border-black">
          <User className="w-4 h-4 text-black stroke-[2.5]" />
          <h2 className="font-heading font-black text-base text-black">
            Healthcare Worker Profile
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-cream border-2 border-black rounded-lg space-y-1 shadow-brutal-xs">
            <span className="text-[11px] font-heading font-black uppercase tracking-wider text-neutral-600 block">
              Staff Name
            </span>
            <span className="font-black text-black text-base block">
              {user?.name || 'Sarah Jenkins'}
            </span>
            <span className="text-xs text-neutral-600 font-bold block">
              {user?.role || 'Community Health Worker'}
            </span>
          </div>

          <div className="p-4 bg-cream border-2 border-black rounded-lg space-y-1 shadow-brutal-xs">
            <span className="text-[11px] font-heading font-black uppercase tracking-wider text-neutral-600 block">
              Assigned Field Sector
            </span>
            <span className="font-black text-black text-base block">
              {user?.villageSector || 'Ramgarh Health Sector'}
            </span>
            <span className="text-xs text-neutral-600 font-bold block">
              Contact: {user?.phoneNumber || '+91 98765 43210'}
            </span>
          </div>

          <div className="p-4 bg-yellow border-2 border-black rounded-lg space-y-1 sm:col-span-2 shadow-brutal-xs">
            <span className="text-[11px] font-heading font-black uppercase tracking-wider text-black block">
              Authentication Session
            </span>
            <div className="flex items-center gap-2 text-xs font-bold text-black">
              <ShieldCheck className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
              <span>
                Authenticated via central server as <strong>{user?.email || 'sarah.jenkins@ruralcare.org'}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Regional & Language Preferences */}
      <section className="bg-white p-6 sm:p-7 border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b-2 border-black">
          <Globe className="w-4 h-4 text-black stroke-[2.5]" />
          <h2 className="font-heading font-black text-base text-black">
            Language & Regional Localization
          </h2>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="max-w-sm">
            <BrutalSelect
              label="Interface Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={[
                { value: 'en', label: 'English (Primary)' },
                { value: 'hi', label: 'हिन्दी (Hindi)' },
                { value: 'bn', label: 'বাংলা (Bengali)' },
                { value: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ (Santali)' },
              ]}
            />
          </div>

          <div className="pt-2">
            <BrutalButton type="submit" variant="primary" size="sm">
              Save Preferences
            </BrutalButton>
          </div>
        </form>
      </section>

      {/* 4. Data Synchronization Preferences */}
      <section className="bg-white p-6 sm:p-7 border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b-2 border-black">
          <RefreshCw className="w-4 h-4 text-black stroke-[2.5]" />
          <h2 className="font-heading font-black text-base text-black">
            Data Synchronization Behavior
          </h2>
        </div>

        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between p-3.5 rounded-lg bg-cream hover:bg-yellow cursor-pointer border-2 border-black shadow-brutal-xs transition-colors">
            <div>
              <span className="font-black text-black block">Automatic synchronization when online</span>
              <span className="text-xs text-neutral-700 font-bold">Automatically upload pending records to PostgreSQL when network connects</span>
            </div>
            <input
              type="checkbox"
              checked={autoSyncOnline}
              onChange={(e) => setAutoSyncOnline(e.target.checked)}
              className="w-4 h-4 accent-black cursor-pointer"
            />
          </label>
        </div>
      </section>

      {/* 5. Device Storage & Local Data Management */}
      <section className="bg-white p-6 sm:p-7 border-2 border-black rounded-xl shadow-brutal space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b-2 border-black">
          <HardDrive className="w-4 h-4 text-black stroke-[2.5]" />
          <h2 className="font-heading font-black text-base text-black">
            Local Device Storage & Cache
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3.5 bg-cream border-2 border-black rounded-lg shadow-brutal-xs">
            <span className="text-2xl font-heading font-black text-black">{patientCount}</span>
            <span className="text-[11px] text-neutral-700 font-bold block mt-0.5">Patients Cached</span>
          </div>
          <div className="p-3.5 bg-cream border-2 border-black rounded-lg shadow-brutal-xs">
            <span className="text-2xl font-heading font-black text-black">{followUpCount}</span>
            <span className="text-[11px] text-neutral-700 font-bold block mt-0.5">Visits Cached</span>
          </div>
          <div className="p-3.5 bg-cream border-2 border-black rounded-lg shadow-brutal-xs">
            <span className="text-2xl font-heading font-black text-black">{taskCount}</span>
            <span className="text-[11px] text-neutral-700 font-bold block mt-0.5">Tasks Cached</span>
          </div>
          <div className="p-3.5 bg-yellow border-2 border-black rounded-lg shadow-brutal-xs">
            <span className="text-2xl font-heading font-black text-black">{queueCount}</span>
            <span className="text-[11px] text-black font-black block mt-0.5">Waiting Sync</span>
          </div>
        </div>

        {clearError && (
          <div className="p-3.5 bg-danger text-black border-2 border-black rounded-lg text-xs font-black flex items-start gap-2 shadow-brutal-xs">
            <AlertTriangle className="w-4 h-4 text-black shrink-0 mt-0.5 stroke-[2.5]" />
            <span>{clearError}</span>
          </div>
        )}

        <div className="pt-3 border-t-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-neutral-600 font-bold">
            <p><strong className="text-black">RuralCare Connect</strong> • Field Platform v1.2</p>
            <p>Clearing device cache will remove local offline data only. Server records remain intact.</p>
          </div>

          <BrutalButton
            variant="danger"
            size="sm"
            disabled={isClearing}
            onClick={handleClearLocalData}
            icon={<Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />}
          >
            {isClearing ? 'Clearing Local Data...' : 'Clear Local Data'}
          </BrutalButton>
        </div>
      </section>
    </div>
  );
};
