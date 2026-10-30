import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  WifiOff, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  Users, 
  Clock, 
  Globe, 
  CalendarCheck,
  ClipboardList,
  Check,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { Logo } from '../components/ui/Logo';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-cream text-black flex flex-col font-body selection:bg-yellow selection:text-black">
      {/* 1. Public Header */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 shadow-brutal-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" to="/" />

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-black text-black">
            <a href="#problem" className="hover:text-forest transition-colors">The Challenge</a>
            <a href="#solution" className="hover:text-forest transition-colors">Architecture</a>
            <a href="#features" className="hover:text-forest transition-colors">Field Tools</a>
            <a href="#how-it-works" className="hover:text-forest transition-colors">Workflow</a>
            <a href="#why-ruralcare" className="hover:text-forest transition-colors">Why RuralCare</a>
          </nav>

          {/* Header Action */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <BrutalButton variant="white" size="sm">
                Sign In
              </BrutalButton>
            </Link>
            <Link to="/login" className="hidden sm:inline-block">
              <BrutalButton variant="primary" size="sm" icon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}>
                Access Workspace
              </BrutalButton>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Energetic Hero Section with Bold Sunflower Yellow Background */}
      <section className="px-4 sm:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24 border-b-2 border-black bg-yellow">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest text-white border-2 border-black text-xs font-black shadow-brutal-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
              <span>Offline-First Healthcare Field Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-black tracking-tight text-black leading-[1.08]">
              Healthcare doesn't stop when the internet does.
            </h1>

            <p className="text-base sm:text-lg text-black font-extrabold leading-relaxed max-w-2xl">
              Empowering community health workers with reliable offline patient follow-up, immunization records, and maternal health management in low-connectivity rural communities.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link to="/login">
                <BrutalButton variant="forest" size="lg" icon={<ArrowRight className="w-5 h-5 stroke-[2.5]" />}>
                  Access Field Terminal
                </BrutalButton>
              </Link>
              <a href="#features">
                <BrutalButton variant="white" size="lg">
                  Explore Capabilities
                </BrutalButton>
              </a>
            </div>

            {/* Core Benefits: High-Contrast White Cards with 2px Black Borders */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t-2 border-black">
              <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-1">
                <span className="font-heading font-black text-sm text-forest block">
                  Offline Continuity
                </span>
                <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                  Full patient registry and visit history remain accessible without cellular coverage.
                </p>
              </div>
              <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-1">
                <span className="font-heading font-black text-sm text-forest block">
                  Local Device Storage
                </span>
                <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                  Records commit instantly to the worker's device with zero reliance on cloud latency.
                </p>
              </div>
              <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-1">
                <span className="font-heading font-black text-sm text-forest block">
                  Automatic Sync
                </span>
                <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                  Queued field records safely synchronize when network connectivity returns.
                </p>
              </div>
            </div>
          </div>

          {/* Right Image Column (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="relative bg-white border-2 border-black rounded-2xl overflow-hidden shadow-brutal-lg">
                <img
                  src="/images/chw_hero.jpg"
                  alt="Community health worker interacting with patient in rural village setting"
                  className="w-full h-[380px] sm:h-[440px] object-cover"
                />
                <div className="p-4 bg-white border-t-2 border-black">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-black">
                      Community Health Worker (ASHA / CHW) Village Rounds
                    </p>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-forest text-white border-2 border-black shadow-brutal-xs">
                      Field Active
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-700 font-bold mt-1">
                    Field record verification and maternal healthcare tracking with zero cloud dependency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Problem */}
      <section id="problem" className="px-4 sm:px-8 py-16 lg:py-24 bg-cream border-b-2 border-black">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-2xl space-y-3">
            <span className="px-3.5 py-1 rounded text-xs font-heading font-black uppercase tracking-wider bg-forest text-white border-2 border-black shadow-brutal-xs inline-block">
              The Reality in the Field
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-black">
              The Connectivity Gap in Rural Healthcare
            </h2>
            <p className="text-neutral-800 font-bold text-sm sm:text-base leading-relaxed">
              When community health workers enter remote hamlets, cellular coverage drops. Traditional cloud-first applications stall or drop patient entries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
              <div className="w-12 h-12 rounded-xl bg-yellow border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
                <WifiOff className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-lg text-black">Unreliable Cellular Coverage</h3>
              <p className="text-neutral-700 font-bold text-xs sm:text-sm leading-relaxed">
                Rural topography and weak cellular infrastructure frequently disconnect field terminals mid-registration, preventing standard form submissions.
              </p>
            </div>

            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
              <div className="w-12 h-12 rounded-xl bg-forest border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <Clock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-lg text-black">Missed Follow-up Deadlines</h3>
              <p className="text-neutral-700 font-bold text-xs sm:text-sm leading-relaxed">
                Postpartum visits, infant wellness tracking, and routine blood pressure checks risk postponement without access to previous records.
              </p>
            </div>

            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
              <div className="w-12 h-12 rounded-xl bg-secondary border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <ClipboardList className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-lg text-black">Double Paperwork Burden</h3>
              <p className="text-neutral-700 font-bold text-xs sm:text-sm leading-relaxed">
                Workers often log visits on paper notebooks first, then spend late hours re-entering entries once home in Wi-Fi zones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Deep Forest Green Solution / Architecture Section */}
      <section id="solution" className="px-4 sm:px-8 py-16 lg:py-24 border-b-2 border-black bg-forest text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="px-3.5 py-1 rounded text-xs font-heading font-black uppercase tracking-wider bg-yellow text-black border-2 border-black shadow-brutal-xs inline-block">
              Architectural Approach
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-white leading-tight">
              An offline-first platform designed for real field environments.
            </h2>
            <p className="text-neutral-200 font-medium text-sm sm:text-base leading-relaxed">
              RuralCare Connect shifts the primary source of truth to the health worker's device. Patient registration, visit notes, and task completion commit instantly to local storage.
            </p>
            <p className="text-neutral-200 font-medium text-sm sm:text-base leading-relaxed">
              When internet connectivity returns, our background synchronization engine safely uploads queued mutations to the central database—preventing data loss and resolving conflicts deterministically.
            </p>

            <div className="pt-2">
              <Link to="/login">
                <BrutalButton variant="primary" size="md" icon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}>
                  Open Field Terminal
                </BrutalButton>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 p-6 sm:p-8 bg-white text-black border-2 border-black rounded-2xl shadow-brutal-lg space-y-6">
            <h3 className="font-heading font-black text-lg text-black border-b-2 border-black pb-3">
              Core Architectural Pillars
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-yellow border-2 border-black flex items-center justify-center shrink-0 mt-0.5 text-black shadow-brutal-xs">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-black">Zero-Wait Field Operations</h4>
                  <p className="text-xs text-neutral-700 font-bold mt-0.5">
                    Save actions execute in under 10 milliseconds. Health workers never wait for network spinners while standing in a patient's home.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-forest border-2 border-black flex items-center justify-center shrink-0 mt-0.5 text-white shadow-brutal-xs">
                  <Database className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-black">Persistent Local Queue</h4>
                  <p className="text-xs text-neutral-700 font-bold mt-0.5">
                    Every patient registration and follow-up is safely preserved in IndexedDB on device until confirmed by central PostgreSQL.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-secondary border-2 border-black flex items-center justify-center shrink-0 mt-0.5 text-white shadow-brutal-xs">
                  <RefreshCw className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-black">Transparent Sync Status</h4>
                  <p className="text-xs text-neutral-700 font-bold mt-0.5">
                    Health workers always see exactly which records are queued on device and which are backed up to the central hospital network.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Features */}
      <section id="features" className="px-4 sm:px-8 py-16 lg:py-24 bg-cream border-b-2 border-black">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="px-3.5 py-1 rounded text-xs font-heading font-black uppercase tracking-wider bg-yellow border-2 border-black text-black shadow-brutal-xs inline-block">
              Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-black">
              Designed for Community Health Workers
            </h2>
            <p className="text-neutral-800 font-bold text-sm sm:text-base">
              Practical field tools replacing paper registers with fast, resilient software.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-yellow border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
                <Users className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Offline Patient Registration</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                Register village members anywhere. Auto-generates local display IDs, captures demographics and household notes without active network.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-forest border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <CalendarCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Follow-up Management</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                Log maternal check-ups, child growth milestones, and routine wellness visits. Predefined categories keep administrative entries quick.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-secondary border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <Database className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Local Device Registry</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                Past visits, household notes, and patient timelines remain fully readable offline. Search and filter instantly with zero lag.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-forest border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <RefreshCw className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Background Synchronization</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                The sync engine detects restored Wi-Fi or cellular signal and silently uploads pending operations with idempotent deduplication.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-yellow border-2 border-black flex items-center justify-center text-black shadow-brutal-xs">
                <ClipboardList className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Daily Field Itinerary</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                Prioritized daily action items, overdue visit flags, and village tasks help health workers organize household rounds effectively.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-secondary border-2 border-black flex items-center justify-center text-white shadow-brutal-xs">
                <Globe className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-heading font-black text-base text-black">Multilingual Ready</h3>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold leading-relaxed">
                Designed for regional localization including Hindi, Bengali, and Santali, ensuring community health workers feel natural and confident.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. How It Works */}
      <section id="how-it-works" className="px-4 sm:px-8 py-16 lg:py-24 border-b-2 border-black bg-white">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="px-3.5 py-1 rounded text-xs font-heading font-black uppercase tracking-wider bg-forest text-white border-2 border-black shadow-brutal-xs inline-block">
              Field Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-black">
              How RuralCare Connect Works
            </h2>
            <p className="text-neutral-800 font-bold text-sm sm:text-base">
              A 5-step operational flow ensuring patient care never depends on cell tower range.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Register Patient',
                desc: 'Enter patient demographic details and assign a unique local village identifier.',
              },
              {
                step: '02',
                title: 'Save Locally',
                desc: 'Information is committed to browser device storage in under 5 milliseconds.',
              },
              {
                step: '03',
                title: 'Work Offline',
                desc: 'Continue household rounds, log visits, and schedule follow-ups without internet.',
              },
              {
                step: '04',
                title: 'Reconnect Signal',
                desc: 'When walking into cellular range or connecting to clinic Wi-Fi, connection triggers.',
              },
              {
                step: '05',
                title: 'Synchronize',
                desc: 'Pending queue uploads, server confirms acknowledgement, and status marks synced.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-5 bg-cream border-2 border-black rounded-xl space-y-2 relative shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all"
              >
                <span className="text-xs font-heading font-black text-black bg-yellow px-2.5 py-0.5 rounded border border-black inline-block">
                  STEP {s.step}
                </span>
                <h3 className="font-heading font-black text-base text-black">
                  {s.title}
                </h3>
                <p className="text-xs text-neutral-700 leading-relaxed font-bold">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Energetic Call to Action Banner */}
      <section className="px-4 sm:px-8 py-20 bg-yellow border-b-2 border-black text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black tracking-tight text-black">
            Keep healthcare connected, even offline.
          </h2>
          <p className="text-base sm:text-lg text-black font-extrabold max-w-xl mx-auto">
            Experience the offline-first field workspace designed specifically for rural community health workers.
          </p>
          <div className="pt-2 flex justify-center">
            <Link to="/login">
              <BrutalButton variant="forest" size="lg" icon={<ArrowRight className="w-5 h-5 stroke-[2.5]" />}>
                Access Field Workspace
              </BrutalButton>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Deep Teal Public Footer */}
      <footer className="px-4 sm:px-8 py-8 bg-deepTeal text-white text-xs border-t-2 border-black">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-bold">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-base text-yellow">RuralCare Connect</span>
            <span>•</span>
            <span className="text-neutral-200">Offline-first healthcare support platform for community health workers</span>
          </div>

          <p className="text-center sm:text-right text-neutral-300">
            Healthcare field workflow and record management platform. Synthetic data is used for privacy compliance. Not intended for clinical diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
};
