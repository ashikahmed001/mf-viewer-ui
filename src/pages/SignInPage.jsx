import { SignIn } from '@clerk/clerk-react';
import { TrendingUp } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-8 px-4">
      {/* Brand */}
      <div className="flex items-center gap-3 text-white">
        <TrendingUp className="w-8 h-8 text-indigo-400" />
        <span className="text-2xl font-bold tracking-tight">FundSight</span>
      </div>

      <p className="text-slate-400 text-sm -mt-4">
        Smart money tracking for Indian mutual funds
      </p>

      {/* Clerk sign-in widget */}
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        afterSignInUrl="/"
      />
    </div>
  );
}
