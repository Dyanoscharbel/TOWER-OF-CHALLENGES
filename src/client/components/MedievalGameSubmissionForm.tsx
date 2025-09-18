import { Crown, Scroll, Castle, ExternalLink } from 'lucide-react';

interface MedievalGameSubmissionFormProps {
  onBack?: () => void;
}

export default function MedievalGameSubmissionForm({ onBack }: MedievalGameSubmissionFormProps) {
  const externalFormUrl = 'https://towerofchallengesubmission.netlify.app/';

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Main background: arena image + dark overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(10,10,25,0.78), rgba(10,10,25,0.9)), url('/arena-background.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Main content */}
      <div className="relative z-10 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-6">
            <Castle className="w-12 h-12 text-purple-300 drop-shadow-lg" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent font-serif drop-shadow-lg">
              The Creators’ Tower
            </h1>
            <Castle className="w-12 h-12 text-purple-300 drop-shadow-lg" />
          </div>
          <p className="text-lg text-purple-100 font-serif italic drop-shadow-md">
            Thank you for your interest in contributing to the next level of the tower.
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent mx-auto mt-4 rounded shadow-lg"></div>
        </div>

        <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl p-8 text-purple-100 ring-1 ring-white/10">
          <div className="text-center">
            <Crown className="mx-auto mb-4 w-14 h-14 text-pink-400 drop-shadow-lg" />
            <h2 className="text-2xl font-bold font-serif text-purple-100">Thank you, noble creators!</h2>
            <p className="mt-3 opacity-90">
              To submit your game, please follow the steps below. You’ll be redirected to an external form where you can describe your creation in detail.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-semibold text-purple-200">Step 1</h3>
              <p className="opacity-90">Prepare a few screenshots and a demo video (if possible).</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-semibold text-purple-200">Step 2</h3>
              <p className="opacity-90">Click the button below to open the official submission form.</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <h3 className="font-semibold text-purple-200">Step 3</h3>
              <p className="opacity-90">Fill in all required sections, then submit. Our team will get back to you shortly.</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <a
              href={externalFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 text-white px-8 py-4 rounded-3xl font-bold text-lg transition-all duration-300 shadow-2xl border border-white/20 backdrop-blur-lg"
            >
              <ExternalLink className="w-6 h-6" />
              Open submission form
            </a>
            {onBack && (
              <div className="mt-4">
                <button onClick={onBack} className="text-purple-200 hover:text-white underline-offset-4 hover:underline">
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



