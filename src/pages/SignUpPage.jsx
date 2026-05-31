import { SignUp } from '@clerk/clerk-react';
import { TrendingUp } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-8 px-4">
      {/* Brand */}
      <div className="flex items-center gap-3 text-white">
        <TrendingUp className="w-8 h-8 text-blue-400" />
        <span className="text-2xl font-bold tracking-tight">FundSight</span>
      </div>

      <p className="text-slate-400 text-sm -mt-4">
        Smart money tracking for Indian mutual funds
      </p>

      {/* Clerk sign-up widget */}
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        afterSignUpUrl="/"
      />
    </div>
  );
}
