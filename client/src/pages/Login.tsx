import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  ArrowLeft,
  ShieldCheck,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalInput } from '../components/ui/BrutalInput';
import { Logo } from '../components/ui/Logo';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return route if redirected by ProtectedRoute
  const from = (location.state as any)?.from?.pathname || '/app/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(identifier, password, rememberSession);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Invalid credentials. Please verify your email and password.');
      }
    } catch (err: any) {
      setError('An error occurred during authentication. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center py-8">
      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Back to Home Link */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-black text-black hover:underline"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to Public Overview</span>
          </Link>
        </div>

        {/* Split Screen Container with 2px Black Border and Heavy Offset Shadow */}
        <div className="bg-white border-2 border-black rounded-2xl shadow-brutal-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* Left Column: Authentic Healthcare Photograph with Clear Visibility (5 cols) */}
          <div className="lg:col-span-5 relative text-white p-8 sm:p-10 flex flex-col justify-between overflow-hidden min-h-[420px] lg:min-h-full">
            {/* 1. Full-Color Background Photograph */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('/images/chw_hero.jpg')` }}
            />
            {/* 2. Light, single overlay: 25-30% darkness ensuring photograph is bright and recognizable */}
            <div className="absolute inset-0 bg-black/25" />

            {/* Top Brand Identity with subtle backing for crisp readability */}
            <div className="relative z-10 space-y-3">
              <div className="w-12 h-12 bg-yellow border-2 border-black rounded-xl shadow-brutal flex items-center justify-center relative">
                <div className="absolute w-[36%] h-[70%] bg-black rounded-[2px]" />
                <div className="absolute h-[36%] w-[70%] bg-black rounded-[2px]" />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-teal border-2 border-black rounded-full" />
              </div>
              <div className="bg-black/75 backdrop-blur-sm p-3.5 rounded-xl border-2 border-black shadow-brutal-xs inline-block">
                <h1 className="font-heading font-black text-2xl tracking-tight text-white leading-tight">
                  RuralCare Connect
                </h1>
                <p className="text-xs text-yellow font-black tracking-wide uppercase mt-0.5">
                  Community Healthcare Worker Terminal
                </p>
              </div>
            </div>

            {/* Middle Mission Quote - High Readability Card with Translucent Backing */}
            <div className="relative z-10 my-8 space-y-2 bg-black/75 p-5 rounded-xl border-2 border-black shadow-brutal backdrop-blur-sm">
              <p className="font-heading text-lg sm:text-xl font-black text-white leading-snug">
                "Healthcare follow-ups should never stop because the internet does."
              </p>
              <p className="text-xs text-neutral-200 font-bold">
                Offline patient registration, maternal follow-up tracking, and resilient background synchronization.
              </p>
            </div>

            {/* Bottom Environment Notice */}
            <div className="relative z-10 p-3 bg-yellow text-black border-2 border-black rounded-xl font-black text-xs shadow-brutal flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
              <span>Offline-ready field terminal • PostgreSQL backed</span>
            </div>
          </div>

          {/* Right Column: Clean White Login Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
            <div className="max-w-md w-full mx-auto space-y-6">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-forest text-white border border-black shadow-brutal-xs inline-block mb-2">
                  Staff Authentication
                </span>
                <h2 className="font-heading font-black text-2xl sm:text-3xl text-black tracking-tight">
                  Sign in to your field terminal
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-bold">
                  Access your local patient registry and scheduled visits
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 bg-danger text-black border-2 border-black rounded-lg text-xs font-black shadow-brutal-xs">
                  ⚠️ {error}
                </div>
              )}

              {/* Form - Normal login without prefilled credentials or hints */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <BrutalInput
                  label="Email or Staff Username"
                  type="email"
                  placeholder="name@organization.org"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-black font-heading">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-neutral-600 hover:text-black flex items-center gap-1 font-bold"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="brutal-input text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-black">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="w-4 h-4 accent-yellow cursor-pointer"
                    />
                    <span>Remember this session on this device</span>
                  </label>
                </div>

                <div className="pt-2">
                  <BrutalButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    icon={<Lock className="w-4 h-4 stroke-[2.5]" />}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In to Workspace'}
                  </BrutalButton>
                </div>
              </form>

              <div className="pt-2 text-center text-xs text-neutral-600 font-bold">
                <span>Working in an offline sector?</span>{' '}
                <strong className="text-black underline">Active sessions remain locally cached.</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
