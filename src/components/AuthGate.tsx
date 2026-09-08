import React, { useState } from 'react';
import { KeyRound, Check, AlertCircle } from 'lucide-react';
import { signIn } from '../services/supabaseService';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : (err.message || 'تعذر تسجيل الدخول.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#FBF8EF] border border-[#DED2AC] rounded-2xl shadow-2xl overflow-hidden text-stone-800">
        <div className="bg-[#3B4636] px-6 py-5 text-white flex items-center gap-3 border-b border-[#B89B5E]/30">
          <div className="p-2 bg-[#B89B5E]/20 rounded-xl border border-[#B89B5E]/40 text-[#D8C48F]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#EFE8D6]">تسجيل الدخول</h3>
            <p className="text-xs text-[#D8C48F]/90 mt-0.5">سجل التقارير اليومية</p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full px-4 py-3 text-sm bg-white border border-[#DED2AC] rounded-xl focus:outline-none focus:border-[#B89B5E] focus:ring-2 focus:ring-[#B89B5E]/20 text-stone-900"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white border border-[#DED2AC] rounded-xl focus:outline-none focus:border-[#B89B5E] focus:ring-2 focus:ring-[#B89B5E]/20 text-stone-900"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full bg-[#3B4636] hover:bg-[#4B5842] text-[#F2EEDD] font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-xs"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جارٍ التحقق...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#D8C48F]" />
                  <span>دخول</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
